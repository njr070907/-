import pytest

from backend.app.services.notice_processing import (
    NoticeExtraction,
    compare_notice_versions,
    extract_notice_fields,
)


def test_extracts_only_explicit_fields_with_evidence() -> None:
    raw_text = """2026 年春季奖学金材料提交通知
适用对象：电子信息学院2025级本科生、研究生
办理阶段：学院初审
请于2026年9月21日18:30前通过学生事务系统提交。
材料：申请表、成绩单
原截止时间调整为2026年9月21日18:30。"""

    result = extract_notice_fields(raw_text)

    assert result.matter_name == "2026 年春季奖学金材料提交通知"
    assert result.audience == ["电子信息学院2025级本科生", "研究生"]
    assert result.stage == "学院初审"
    assert result.deadline == "2026-09-21T18:30"
    assert result.submit_channel == "学生事务系统"
    assert result.materials == ["申请表", "成绩单"]
    assert result.explicit_change == "原截止时间调整为2026年9月21日18:30。"
    assert {item.field for item in result.evidence} >= {
        "matter_name",
        "audience",
        "stage",
        "deadline",
        "submit_channel",
        "materials",
        "explicit_change",
    }


def test_keeps_yearless_date_unconfirmed_and_does_not_invent_fields() -> None:
    raw_text = "请于9月21日18:30前完成填报，具体入口以后续通知为准。"

    result = extract_notice_fields(raw_text)

    assert result.deadline is None
    assert result.matter_name == ""
    assert result.submit_channel == ""
    assert result.audience == []
    assert result.materials == []
    assert result.evidence[-1].field == "deadline"
    assert result.evidence[-1].text == "9月21日18:30"


def test_rejects_blank_notice() -> None:
    with pytest.raises(ValueError, match="raw_text cannot be blank"):
        extract_notice_fields("  \n")


def test_compares_only_deadline_audience_channel_and_materials() -> None:
    previous = NoticeExtraction(
        matter_name="奖学金材料",
        audience=["大一学生"],
        stage="班级收集",
        deadline="2026-09-20T18:00",
        submit_channel="班委邮箱",
        materials=["申请表"],
        confidence=1,
    )
    current = NoticeExtraction(
        matter_name="奖学金材料更新",
        audience=["大一学生", "大二学生"],
        stage="学院审核",
        deadline="2026-09-21T18:00",
        submit_channel="学生事务系统",
        materials=["申请表", "成绩单"],
        confidence=1,
    )

    result = compare_notice_versions(previous, current)

    assert [change.field for change in result.changes] == [
        "deadline",
        "audience",
        "submit_channel",
        "materials",
    ]
    assert result.summary == [
        "截止时间：2026-09-20T18:00 → 2026-09-21T18:00",
        "适用对象：大一学生 → 大一学生、大二学生",
        "提交入口：班委邮箱 → 学生事务系统",
        "材料要求：申请表 → 申请表、成绩单",
    ]
