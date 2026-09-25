from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import Notice


def test_extract_confirm_associate_and_complete_weekly_task(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            first = client.post(
                "/api/notices",
                json={
                    "raw_text": (
                        "奖学金材料提交通知\n"
                        "适用对象：大一学生\n"
                        "办理阶段：学院初审\n"
                        "请于2026年9月21日18:30前通过学生事务系统提交。\n"
                        "材料：申请表、成绩单"
                    )
                },
            )
            assert first.status_code == 201
            first_id = first.json()["id"]

            extracted = client.post(f"/api/notices/{first_id}/extract")
            assert extracted.status_code == 200
            assert extracted.json()["parse_status"] == "review_required"
            fields = extracted.json()["extracted_json"]
            assert fields["deadline"] == "2026-09-21T18:30"
            assert fields["evidence"]

            confirmed = client.post(
                f"/api/notices/{first_id}/confirm",
                json={
                    "extraction": fields,
                    "new_matter_name": "2026 年奖学金材料",
                    "task": {
                        "stage": "学院初审",
                        "deadline": fields["deadline"],
                        "submit_channel": fields["submit_channel"],
                        "materials": fields["materials"],
                    },
                },
            )
            assert confirmed.status_code == 200
            assert confirmed.json()["parse_status"] == "confirmed"
            matter_id = confirmed.json()["matter_id"]
            assert matter_id

            second = client.post(
                "/api/notices",
                json={"raw_text": "奖学金材料补充通知\n请按学院要求补交。"},
            )
            assert second.status_code == 201
            associated = client.post(
                f"/api/matters/{matter_id}/notices/{second.json()['id']}"
            )
            assert associated.status_code == 200
            assert associated.json()["matter_id"] == matter_id

            no_deadline_task = client.post(
                f"/api/notices/{second.json()['id']}/confirm",
                json={
                    "extraction": {
                        **fields,
                        "audience": ["大一学生", "大二学生"],
                        "deadline": "2026-09-22T18:30",
                        "materials": ["申请表", "成绩单", "身份证明"],
                    },
                    "matter_id": matter_id,
                    "task": {
                        "stage": "班级收集",
                        "deadline": None,
                        "submit_channel": "",
                        "materials": [],
                    },
                },
            )
            assert no_deadline_task.status_code == 200

            detail = client.get(f"/api/matters/{matter_id}")
            assert detail.status_code == 200
            assert len(detail.json()["notices"]) == 2
            assert len(detail.json()["tasks"]) == 2

            comparison = client.get(
                f"/api/matters/{matter_id}/compare",
                params={
                    "previous_notice_id": first_id,
                    "current_notice_id": second.json()["id"],
                },
            )
            assert comparison.status_code == 200
            assert comparison.json()["previous_notice_id"] == first_id
            assert comparison.json()["current_notice_id"] == second.json()["id"]
            assert [change["field"] for change in comparison.json()["changes"]] == [
                "deadline",
                "audience",
                "materials",
            ]
            same_notice = client.get(
                f"/api/matters/{matter_id}/compare",
                params={
                    "previous_notice_id": first_id,
                    "current_notice_id": first_id,
                },
            )
            assert same_notice.status_code == 422

            weekly = client.get("/api/tasks/week?start=2026-09-20")
            assert weekly.status_code == 200
            assert len(weekly.json()) == 1
            task_id = weekly.json()[0]["id"]
            completed = client.patch(f"/api/tasks/{task_id}", json={"completed": True})
            assert completed.status_code == 200
            assert completed.json()["completed"] is True

            invalid = client.post(
                f"/api/notices/{second.json()['id']}/confirm",
                json={"extraction": fields},
            )
            assert invalid.status_code == 422

            unconfirmed = client.post(
                "/api/notices", json={"raw_text": "尚未确认的补充通知"}
            )
            assert unconfirmed.status_code == 201
            client.post(
                f"/api/matters/{matter_id}/notices/{unconfirmed.json()['id']}"
            )
            blocked = client.get(
                f"/api/matters/{matter_id}/compare",
                params={
                    "previous_notice_id": first_id,
                    "current_notice_id": unconfirmed.json()["id"],
                },
            )
            assert blocked.status_code == 422

            other = client.post(
                "/api/notices", json={"raw_text": "另一事项通知\n办理阶段：学院审核"}
            )
            other_fields = client.post(f"/api/notices/{other.json()['id']}/extract").json()[
                "extracted_json"
            ]
            other_confirmed = client.post(
                f"/api/notices/{other.json()['id']}/confirm",
                json={
                    "extraction": other_fields,
                    "new_matter_name": "另一事项",
                },
            )
            assert other_confirmed.status_code == 200
            cross_matter = client.get(
                f"/api/matters/{matter_id}/compare",
                params={
                    "previous_notice_id": first_id,
                    "current_notice_id": other.json()["id"],
                },
            )
            assert cross_matter.status_code == 422

            legacy = client.post(
                "/api/notices", json={"raw_text": "历史确认通知"}
            )
            with sessions() as db:
                legacy_notice = db.get(Notice, legacy.json()["id"])
                assert legacy_notice is not None
                legacy_notice.matter_id = matter_id
                legacy_notice.parse_status = "confirmed"
                db.commit()
            missing_fields = client.get(
                f"/api/matters/{matter_id}/compare",
                params={
                    "previous_notice_id": first_id,
                    "current_notice_id": legacy.json()["id"],
                },
            )
            assert missing_fields.status_code == 422
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_moving_a_notice_moves_its_task_and_drops_the_emptied_matter(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            notice_id = client.post(
                "/api/notices", json={"raw_text": "奖学金通知\n办理阶段：学院初审"}
            ).json()["id"]
            fields = client.post(f"/api/notices/{notice_id}/extract").json()["extracted_json"]
            first = client.post(
                f"/api/notices/{notice_id}/confirm",
                json={
                    "extraction": fields,
                    "new_matter_name": "旧事项",
                    "task": {"stage": "学院初审", "deadline": "2026-09-21", "submit_channel": "", "materials": []},
                },
            )
            old_matter_id = first.json()["matter_id"]
            kept = client.post(
                "/api/notices", json={"raw_text": "仍属于保留事项的通知"}
            ).json()["id"]
            keeper_id = client.post("/api/matters", json={"name": "保留事项"}).json()["id"]
            client.post(f"/api/matters/{keeper_id}/notices/{kept}")

            moved = client.post(f"/api/matters/{keeper_id}/notices/{notice_id}")
            assert moved.status_code == 200
            keeper = client.get(f"/api/matters/{keeper_id}").json()
            assert {notice["id"] for notice in keeper["notices"]} == {notice_id, kept}
            assert [task["source_notice_id"] for task in keeper["tasks"]] == [notice_id]
            assert client.get(f"/api/matters/{old_matter_id}").status_code == 404

            # Re-confirming without a task keeps the existing task with the notice,
            # and the matter that still has another notice is not deleted.
            reconfirmed = client.post(
                f"/api/notices/{notice_id}/confirm",
                json={"extraction": fields, "new_matter_name": "新事项"},
            )
            assert reconfirmed.status_code == 200
            new_matter = client.get(f"/api/matters/{reconfirmed.json()['matter_id']}").json()
            assert [task["source_notice_id"] for task in new_matter["tasks"]] == [notice_id]
            keeper = client.get(f"/api/matters/{keeper_id}").json()
            assert [notice["id"] for notice in keeper["notices"]] == [kept]
            assert keeper["tasks"] == []
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
