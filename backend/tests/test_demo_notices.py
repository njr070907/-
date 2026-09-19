import json
from pathlib import Path

from backend.app.config import PROJECT_ROOT
from backend.app.services.notice_processing import (
    compare_notice_versions,
    extract_notice_fields,
)

RAW_DIR = PROJECT_ROOT / "data" / "raw"
EXPECTED = {
    "demo_scholarship_school_v1": {
        "matter_name": "[脱敏演示数据] 关于2026年奖学金材料提交的学校通知",
        "audience": ["全体本科生"],
        "stage": "学校最终提交",
        "deadline": "2026-09-22T18:00",
        "submit_channel": "学生事务系统",
        "materials": ["申请表", "成绩单"],
    },
    "demo_scholarship_college_v2": {
        "matter_name": "[脱敏演示数据] 关于2026年奖学金材料提交的学院通知",
        "audience": ["全体本科生"],
        "stage": "学院初审",
        "deadline": "2026-09-25T12:00",
        "submit_channel": "学院材料平台",
        "materials": ["申请表", "成绩单", "身份证复印件"],
    },
    "demo_activity_initial_v1": {
        "matter_name": "[脱敏演示数据] 关于秋季校园活动报名的通知",
        "audience": ["全体在校学生"],
        "stage": "学生报名",
        "deadline": "2026-10-08T20:00",
        "submit_channel": "校园活动平台",
        "materials": ["报名信息"],
    },
    "demo_activity_updated_v2": {
        "matter_name": "[脱敏演示数据] 关于秋季校园活动报名的更新通知",
        "audience": ["大一", "大二学生"],
        "stage": "学生报名",
        "deadline": "2026-10-08T20:00",
        "submit_channel": "学生综合服务平台",
        "materials": ["报名信息"],
    },
    "demo_class_material_collection": {
        "matter_name": "[脱敏演示数据] 关于班级材料收集的通知",
        "audience": ["2026级1班学生"],
        "stage": "班级收集",
        "deadline": "2026-09-18T17:00",
        "submit_channel": "班级在线表单",
        "materials": ["登记表", "证明材料"],
    },
    "demo_incomplete_deadline": {
        "matter_name": "[脱敏演示数据] 关于材料补充事项的通知",
        "audience": ["相关学生"],
        "stage": "待确认",
        "deadline": None,
        "submit_channel": "材料补充平台",
        "materials": ["补充材料"],
    },
}


def load_demo_notices() -> dict[str, dict]:
    notices = {}
    for path in sorted(RAW_DIR.glob("demo_*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        notices[payload["id"]] = payload
    return notices


def test_demo_notices_match_expected_extractions() -> None:
    notices = load_demo_notices()
    assert set(notices) == set(EXPECTED)

    extractions = {}
    for notice_id, expected in EXPECTED.items():
        extraction = extract_notice_fields(notices[notice_id]["raw_text"])
        extractions[notice_id] = extraction
        for field, value in expected.items():
            assert getattr(extraction, field) == value, (notice_id, field)

    incomplete = extractions["demo_incomplete_deadline"]
    assert incomplete.deadline is None
    assert any(
        evidence.field == "deadline" and evidence.text == "9月21日18:00"
        for evidence in incomplete.evidence
    )

    scholarship = compare_notice_versions(
        extractions["demo_scholarship_school_v1"],
        extractions["demo_scholarship_college_v2"],
    )
    assert [change.field for change in scholarship.changes] == [
        "deadline",
        "submit_channel",
        "materials",
    ]

    activity = compare_notice_versions(
        extractions["demo_activity_initial_v1"],
        extractions["demo_activity_updated_v2"],
    )
    assert [change.field for change in activity.changes] == [
        "audience",
        "submit_channel",
    ]