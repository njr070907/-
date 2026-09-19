import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from backend.app.config import PROJECT_ROOT
from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models import Notice
from backend.scripts.import_seed_data import import_directory


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

        with sessions() as db:
            assert db.scalar(select(func.count()).select_from(Notice)) == len(seeds) + 1
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