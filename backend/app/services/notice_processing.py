"""Extract explicit notice fields and compare two confirmed notice versions.

This module deliberately has no database or HTTP dependency.  A later API layer can
call these functions, while users retain the right to edit every returned value.
"""

from __future__ import annotations

import re
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


FieldName = Literal[
    "matter_name",
    "audience",
    "stage",
    "deadline",
    "submit_channel",
    "materials",
    "explicit_change",
]
ComparedField = Literal["deadline", "audience", "submit_channel", "materials"]


class Evidence(BaseModel):
    """A literal fragment from the notice that supports one extracted field."""

    field: FieldName
    text: str = Field(min_length=1)


class NoticeExtraction(BaseModel):
    """The fixed output contract shared by the extraction and review screens."""

    matter_name: str = ""
    audience: list[str] = Field(default_factory=list)
    stage: str = ""
    deadline: str | None = None
    submit_channel: str = ""
    materials: list[str] = Field(default_factory=list)
    explicit_change: str = ""
    confidence: float = Field(default=0, ge=0, le=1)
    evidence: list[Evidence] = Field(default_factory=list)


class FieldChange(BaseModel):
    field: ComparedField
    before: str | list[str] | None
    after: str | list[str] | None


class VersionComparison(BaseModel):
    changes: list[FieldChange] = Field(default_factory=list)
    summary: list[str] = Field(default_factory=list)


_LABELED_LINE = {
    "audience": re.compile(
        r"(?:适用对象|面向对象|通知对象|参加人员|参与对象|对象)\s*[：:]\s*([^\n。；;]+)"
    ),
    "stage": re.compile(r"(?:办理环节|办理阶段|阶段)\s*[：:]\s*([^\n。；;]+)"),
    "materials": re.compile(r"(?:材料|提交材料)(?:包括|为)?\s*[：:]\s*([^\n。；;]+)"),
}
# Date mentions such as "2026年9月23日（周三）下午4:15" or "9月21日18点半".
# A time needs an explicit separator, so "9月21日 12个学院" is not read as 12:00.
_GAP = "[ \t\N{IDEOGRAPHIC SPACE}]*"
_WEEKDAY = "(?:" + _GAP + r"[（(](?:星期|周|礼拜)[一二三四五六日天][）)])?"
_TIME = (
    "(?:" + _GAP + "(?P<period>上午|早上|中午|下午|傍晚|晚上)?" + _GAP
    + r"(?P<hour>\d{1,2})" + _GAP
    + r"(?:[:：]" + _GAP + r"(?P<minute>\d{2})"
    + r"|[点时](?:(?P<half>半)|(?P<cn_minute>\d{1,2})分?)?))?"
)
_DATE_MENTION = re.compile(
    r"(?<!\d)(?:(?P<year>\d{4})" + _GAP + "年" + _GAP + ")?"
    + r"(?P<month>\d{1,2})" + _GAP + "月" + _GAP + r"(?P<day>\d{1,2})" + _GAP + "[日号]"
    + _WEEKDAY + _TIME
)
# The end of a range such as "9月21日至10月12日" or "9月1日—15日"; a bare
# time range like "14:30–16:30" has no day and is not treated as a date range.
_RANGE_END = re.compile(
    _GAP + "(?:至|到|~|～|—{1,2}|–|-)" + _GAP
    + r"(?:(?P<year>\d{4})" + _GAP + "年" + _GAP + ")?"
    + r"(?:(?P<month>\d{1,2})" + _GAP + "月" + _GAP + ")?"
    + r"(?P<day>\d{1,2})" + _GAP + "[日号]"
    + _WEEKDAY + _TIME
)
_CLAUSE_BREAKS = frozenset("\n。；;！!？?，,")
_DEADLINE_WORDS = ("截止", "截至", "逾期", "最晚", "最迟", "不晚于")
_DEADLINE_SUFFIXES = ("前", "之前", "以前")
_UPDATE_WORDS = ("调整为", "变更为", "更新为", "修改为", "改为", "延长至", "推迟至", "延期至")
_PUBLISH_WORDS = ("发布", "发文", "印发", "更新时间", "更新于")
_LABEL_WORDS = ("时间", "日期")
_SUBMIT_PATTERNS = (
    re.compile(r"(?:提交|报送)(?:至|到)\s*([^\n。；;]+)"),
    re.compile(r"通过\s*([^\s，,。；;]{2,40}?)(?:提交|报送)"),
)
_CHANGE_WORDS = ("调整为", "变更为", "更新为", "修改为")
_COMPARE_LABELS = {
    "deadline": "截止时间",
    "audience": "适用对象",
    "submit_channel": "提交入口",
    "materials": "材料要求",
}


def extract_notice_fields(raw_text: str) -> NoticeExtraction:
    """Return only information literally present in a manually pasted notice.

    A date without a year stays ``None``.  Its original fragment is kept as
    evidence so the review screen can ask the user to fill it in.
    """

    if not raw_text or not raw_text.strip():
        raise ValueError("raw_text cannot be blank")

    evidence: list[Evidence] = []
    matter_name = _first_heading(raw_text)
    if matter_name:
        evidence.append(Evidence(field="matter_name", text=matter_name))

    audience = _extract_list(raw_text, "audience", evidence)
    stage = _extract_text(raw_text, "stage", evidence)
    materials = _extract_list(raw_text, "materials", evidence)
    deadline = _extract_deadline(raw_text, evidence)
    submit_channel = _extract_submit_channel(raw_text, evidence)
    explicit_change = _extract_change(raw_text, evidence)

    found = sum(
        bool(value)
        for value in (
            matter_name,
            audience,
            stage,
            deadline,
            submit_channel,
            materials,
            explicit_change,
        )
    )
    return NoticeExtraction(
        matter_name=matter_name,
        audience=audience,
        stage=stage,
        deadline=deadline,
        submit_channel=submit_channel,
        materials=materials,
        explicit_change=explicit_change,
        confidence=round(found / 7, 2),
        evidence=evidence,
    )


def compare_notice_versions(
    previous: NoticeExtraction | Mapping[str, Any],
    current: NoticeExtraction | Mapping[str, Any],
) -> VersionComparison:
    """Compare the four presentation-critical fields without using an AI model."""

    changes: list[FieldChange] = []
    summary: list[str] = []
    for field in ("deadline", "audience", "submit_channel", "materials"):
        before = _read_field(previous, field)
        after = _read_field(current, field)
        if before == after:
            continue
        changes.append(FieldChange(field=field, before=before, after=after))
        summary.append(f"{_COMPARE_LABELS[field]}：{_display(before)} → {_display(after)}")
    return VersionComparison(changes=changes, summary=summary)


def _first_heading(raw_text: str) -> str:
    for line in raw_text.splitlines():
        cleaned = line.strip()
        if cleaned and (
            cleaned.startswith(("【", "["))
            or cleaned.endswith(("通知", "公告"))
        ):
            return cleaned[:200]
    return ""


def _extract_text(raw_text: str, field: FieldName, evidence: list[Evidence]) -> str:
    match = _LABELED_LINE[field].search(raw_text)
    if not match:
        return ""
    value = match.group(1).strip()
    if value:
        evidence.append(Evidence(field=field, text=match.group(0).strip()))
    return value


def _extract_list(raw_text: str, field: Literal["audience", "materials"], evidence: list[Evidence]) -> list[str]:
    value = _extract_text(raw_text, field, evidence)
    return [item.strip() for item in re.split(r"[、，,；;]", value) if item.strip()]


@dataclass(frozen=True)
class _DateMention:
    start: int
    end: int
    year: int | None
    month: int
    day: int
    time: tuple[int, int] | None


def _extract_deadline(raw_text: str, evidence: list[Evidence]) -> str | None:
    """Pick the date most likely to be the deadline.

    Dates next to 截止/前 win over labelled 时间/日期 lines, which win over
    other dates; publication dates are ignored.  A new value after 调整为 wins
    over the old one.  If the winning date has no year, return ``None`` rather
    than falling back to a different date or guessing the year.
    """

    best: _DateMention | None = None
    best_score = 0
    for mention in _date_mentions(raw_text):
        score = _deadline_score(raw_text, mention)
        if score is not None and score > best_score:
            best, best_score = mention, score
    if best is None:
        return None

    evidence.append(Evidence(field="deadline", text=raw_text[best.start : best.end].strip()))
    if best.year is None:
        return None
    value = f"{best.year:04}-{best.month:02}-{best.day:02}"
    if best.time is None:
        return value
    hour, minute = best.time
    return f"{value}T{hour:02}:{minute:02}"


def _date_mentions(raw_text: str) -> Iterator[_DateMention]:
    consumed = 0
    for match in _DATE_MENTION.finditer(raw_text):
        if match.start() < consumed:
            continue
        year = int(match["year"]) if match["year"] else None
        month, day = int(match["month"]), int(match["day"])
        if not _is_valid_date(year, month, day):
            continue
        mention = _DateMention(match.start(), match.end(), year, month, day, _parse_time(match))

        range_end = _RANGE_END.match(raw_text, match.end())
        if range_end:
            end_month = int(range_end["month"]) if range_end["month"] else month
            end_day = int(range_end["day"])
            if range_end["year"]:
                end_year: int | None = int(range_end["year"])
            elif year is not None:
                # "2026年12月28日至1月5日" ends in the following year.
                end_year = year + 1 if end_month < month else year
            else:
                end_year = None
            if _is_valid_date(end_year, end_month, end_day):
                mention = _DateMention(
                    match.start(), range_end.end(), end_year, end_month, end_day,
                    _parse_time(range_end),
                )

        consumed = mention.end
        yield mention


def _is_valid_date(year: int | None, month: int, day: int) -> bool:
    try:
        date(year if year is not None else 2000, month, day)  # 2000 allows 2月29日
    except ValueError:
        return False
    return True


def _parse_time(match: re.Match[str]) -> tuple[int, int] | None:
    if match["hour"] is None:
        return None
    hour = int(match["hour"])
    if match["minute"] is not None:
        minute = int(match["minute"])
    elif match["half"]:
        minute = 30
    elif match["cn_minute"] is not None:
        minute = int(match["cn_minute"])
    else:
        minute = 0

    period = match["period"]
    if period in ("下午", "傍晚", "晚上") and 1 <= hour < 12:
        hour += 12
    elif period == "中午" and 1 <= hour < 11:
        hour += 12
    elif period == "晚上" and hour == 12:
        hour = 24
    if hour == 24 and minute == 0:
        return (23, 59)  # "24:00前" means before the end of that day.
    if hour > 23 or minute > 59:
        return None
    return (hour, minute)


def _deadline_score(raw_text: str, mention: _DateMention) -> int | None:
    left = mention.start
    while left > 0 and raw_text[left - 1] not in _CLAUSE_BREAKS:
        left -= 1
    right = mention.end
    while right < len(raw_text) and raw_text[right] not in _CLAUSE_BREAKS:
        right += 1
    before = raw_text[left : mention.start]
    clause = raw_text[left:right]
    after = raw_text[mention.end : right].lstrip()

    if any(word in before for word in _UPDATE_WORDS):
        return 4
    if any(word in clause for word in _DEADLINE_WORDS) or after.startswith(_DEADLINE_SUFFIXES):
        return 3
    if any(word in clause for word in _PUBLISH_WORDS):
        return None
    if any(word in before for word in _LABEL_WORDS):
        return 2
    return 1


def _extract_submit_channel(raw_text: str, evidence: list[Evidence]) -> str:
    for pattern in _SUBMIT_PATTERNS:
        match = pattern.search(raw_text)
        if match:
            value = match.group(1).strip()
            evidence.append(Evidence(field="submit_channel", text=match.group(0).strip()))
            return value
    return ""


def _extract_change(raw_text: str, evidence: list[Evidence]) -> str:
    for line in raw_text.splitlines():
        cleaned = line.strip()
        if any(word in cleaned for word in _CHANGE_WORDS):
            evidence.append(Evidence(field="explicit_change", text=cleaned))
            return cleaned[:300]
    return ""


def _read_field(source: NoticeExtraction | Mapping[str, Any], field: ComparedField) -> str | list[str] | None:
    value = source.get(field) if isinstance(source, Mapping) else getattr(source, field)
    if isinstance(value, tuple):
        return list(value)
    if value is None or isinstance(value, (str, list)):
        return value
    raise TypeError(f"{field} must be a string, list, or None")


def _display(value: str | list[str] | None) -> str:
    if value is None or value == "" or value == []:
        return "未填写"
    return "、".join(value) if isinstance(value, list) else value
