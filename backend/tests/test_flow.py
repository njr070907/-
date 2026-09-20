import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session, sessionmaker

from backend.app.config import PROJECT_ROOT
from backend.app.db import Base, get_db, upgrade_sqlite_schema
from backend.app.main import app
from backend.app.models import Notice
from backend.scripts.import_seed_data import import_demo_notices, import_directory


def test_seed_to_api_flow(tmp_path: Path) -> None:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    raw_dir = PROJECT_ROOT / "data" / "raw"
    seed_files = sorted(raw_dir.glob("*.json"))
    seeds = [json.loads(path.read_text(encoding="utf-8")) for path in seed_files]
    expected_ids = {seed["id"] for seed in seeds}

    first = import_directory(raw_dir, sessions)
    second = import_directory(raw_dir, sessions)
    assert (first.scanned, first.imported, first.failed) == (
        len(seeds),
        len(seeds),
        0,
    )
    assert (second.scanned, second.skipped, second.failed) == (
        len(seeds),
        len(seeds),
        0,
    )

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            assert client.get("/health").json() == {"status": "ok"}

            listing = client.get("/api/notices")
            assert listing.status_code == 200
            assert {item["id"] for item in listing.json()} == expected_ids
            assert all("raw_text" not in item for item in listing.json())
            assert all(item["audience_roles"] is None for item in listing.json())

            detail = client.get("/api/notices/example_notice")
            assert detail.status_code == 200
            assert detail.json()["raw_text"] == json.loads(
                (raw_dir / "example_notice.json").read_text(encoding="utf-8")
            )["raw_text"]
            assert client.get("/api/notices/missing").status_code == 404

            expected_search_ids = {
                seed["id"]
                for seed in seeds
                if "MVP" in (seed.get("title") or "") or "MVP" in seed["raw_text"]
            }
            search = client.get("/api/notices?query=MVP")
            assert search.status_code == 200
            assert {item["id"] for item in search.json()} == expected_search_ids

            created = client.post("/api/notices", json={"raw_text": "新通知正文"})
            assert created.status_code == 201
            assert created.json()["source_type"] == "manual_copy"
            assert created.json()["parse_status"] == "raw"
            assert client.get(f"/api/notices/{created.json()['id']}").json()["raw_text"] == "新通知正文"
            assert client.post("/api/notices", json={"raw_text": "   "}).status_code == 422

            extracted = client.post(f"/api/notices/{created.json()['id']}/extract")
            assert extracted.status_code == 200
            updated = client.patch(
                f"/api/notices/{created.json()['id']}",
                json={"title": "修改后的标题", "raw_text": "修改后的通知正文"},
            )
            assert updated.status_code == 200
            assert updated.json()["id"] == created.json()["id"]
            assert updated.json()["title"] == "修改后的标题"
            assert updated.json()["raw_text"] == "修改后的通知正文"
            assert updated.json()["parse_status"] == "raw"
            assert updated.json()["extracted_json"] is None

            tagged = client.post("/api/notices", json={
                "raw_text": "演示专业事项", "audience_roles": ["postgraduate"],
                "colleges": ["计算机科学与技术学院"], "tags": ["科研"],
                "required": True, "deadline": "2026-10-01T00:00:00Z",
            })
            assert tagged.status_code == 201
            assert tagged.json()["audience_roles"] == ["postgraduate"]
            assert tagged.json()["required"] is True

        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(Notice)) == len(seeds) + 2
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_bad_seed_file_reports_error_and_continues(tmp_path: Path, capsys) -> None:
    (tmp_path / "bad.json").write_text("{bad", encoding="utf-8")
    (tmp_path / "good.json").write_text(
        '{"id":"good","raw_text":"完整原文"}', encoding="utf-8"
    )
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    result = import_directory(tmp_path, sessionmaker(bind=engine))
    assert (result.scanned, result.imported, result.failed) == (2, 1, 1)
    assert "bad.json" in capsys.readouterr().out
    engine.dispose()


def test_demo_seed_and_existing_sqlite_migration(tmp_path: Path) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as connection:
        connection.execute(text("""CREATE TABLE notices (
            id VARCHAR(120) PRIMARY KEY, title VARCHAR(500), raw_text TEXT NOT NULL,
            source_name VARCHAR(255), source_url TEXT, published_at DATETIME,
            collected_by VARCHAR(255), collected_at DATETIME, imported_at DATETIME,
            source_type VARCHAR(50), parse_status VARCHAR(50), created_at DATETIME
        )"""))
        connection.execute(text("INSERT INTO notices (id, raw_text) VALUES ('legacy', 'old content')"))
    upgrade_sqlite_schema(engine, allowed_root=tmp_path)
    Base.metadata.create_all(engine)
    columns = {column["name"] for column in inspect(engine).get_columns("notices")}
    assert {
        "matter_id", "extracted_json", "audience_roles", "colleges", "majors",
        "grades", "tags", "deadline", "importance", "required",
    } <= columns
    sessions = sessionmaker(bind=engine)
    result = import_demo_notices(PROJECT_ROOT / "data" / "demo_notices.json", sessions)
    assert (result.scanned, result.imported, result.failed) == (15, 15, 0)
    with sessions() as db:
        assert db.get(Notice, "legacy").raw_text == "old content"
        assert db.get(Notice, "demo_teacher_teaching").required is True
    engine.dispose()


def test_cors_preflight_allows_task_patch() -> None:
    with TestClient(app) as client:
        response = client.options(
            "/api/tasks/task_demo",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "PATCH",
            },
        )

    assert response.status_code == 200
    assert "PATCH" in response.headers["access-control-allow-methods"]
