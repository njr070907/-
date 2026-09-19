"""Extract explicit notice fields and compare two confirmed notice versions.

This module deliberately has no database or HTTP dependency.  A later API layer can
call these functions, while users retain the right to edit every returned value.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
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
_EXPLICIT_DATE = re.compile(
    r"(?P<year>\d{4})年(?P<month>\d{1,2})月(?P<day>\d{1,2})日"
    r"(?:\s*(?:上午|下午)?\s*(?P<hour>\d{1,2})(?:(?::|：|时)(?P<minute>\d{1,2}))?)?"
)
_PARTIAL_DATE = re.compile(r"\d{1,2}月\d{1,2}日(?:\s*(?:上午|下午)?\s*\d{1,2}(?:(?::|：|时)\d{1,2})?)?")
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


def _extract_deadline(raw_text: str, evidence: list[Evidence]) -> str | None:
    match = _EXPLICIT_DATE.search(raw_text)
    if match:
        evidence.append(Evidence(field="deadline", text=match.group(0)))
        groups = match.groupdict()
        date = f"{int(groups['year']):04}-{int(groups['month']):02}-{int(groups['day']):02}"
        if groups["hour"] is None:
            return date
        minute = int(groups["minute"] or 0)
        return f"{date}T{int(groups['hour']):02}:{minute:02}"

    partial = _PARTIAL_DATE.search(raw_text)
    if partial:
        evidence.append(Evidence(field="deadline", text=partial.group(0)))
    return None


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
