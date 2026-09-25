from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.config import PROJECT_ROOT, resolve_sqlite_url
from backend.app.db import Base, get_db
from backend.app.main import app


def test_source_url_only_accepts_http_links(tmp_path: Path) -> None:
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
            for bad in ("javascript:alert(1)", "data:text/html,hi", "example.edu/notice"):
                response = client.post("/api/notices", json={"raw_text": "通知", "source_url": bad})
                assert response.status_code == 422, bad

            created = client.post(
                "/api/notices",
                json={"raw_text": "通知", "source_url": " https://example.edu/notice "},
            )
            assert created.status_code == 201
            assert created.json()["source_url"] == "https://example.edu/notice"
            blank = client.post("/api/notices", json={"raw_text": "通知", "source_url": "  "})
            assert blank.json()["source_url"] is None

            updated = client.patch(
                f"/api/notices/{created.json()['id']}",
                json={"raw_text": "通知", "source_url": "javascript:alert(1)"},
            )
            assert updated.status_code == 422
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_relative_sqlite_path_is_resolved_against_the_repository_root() -> None:
    expected = f"sqlite:///{(PROJECT_ROOT / 'backend' / 'app.db').as_posix()}"
    assert resolve_sqlite_url("sqlite:///./backend/app.db") == expected
    assert resolve_sqlite_url("sqlite:///backend/app.db") == expected

    absolute = f"sqlite:///{(PROJECT_ROOT / 'backend' / 'other.db').as_posix()}"
    assert resolve_sqlite_url(absolute) == absolute
    assert resolve_sqlite_url("sqlite:///:memory:") == "sqlite:///:memory:"
    assert resolve_sqlite_url("sqlite://") == "sqlite://"
    assert resolve_sqlite_url("postgresql://user:pw@localhost/db") == "postgresql://user:pw@localhost/db"
