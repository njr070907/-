from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from backend.app.db import Base, upgrade_sqlite_schema
from backend.app.models import Notice


def create_legacy_database(path: Path):
    engine = create_engine(
        f"sqlite:///{path}", connect_args={"check_same_thread": False}
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE notices (
                    id VARCHAR(120) PRIMARY KEY,
                    title VARCHAR(500),
                    raw_text TEXT NOT NULL,
                    source_name VARCHAR(255),
                    source_url TEXT,
                    published_at DATETIME,
                    collected_by VARCHAR(255),
                    collected_at DATETIME,
                    imported_at DATETIME NOT NULL,
                    source_type VARCHAR(50) NOT NULL,
                    parse_status VARCHAR(50) NOT NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO notices (
                    id, raw_text, imported_at, source_type, parse_status, created_at
                ) VALUES (
                    'legacy_notice', '旧通知原文', CURRENT_TIMESTAMP,
                    'manual_copy', 'raw', CURRENT_TIMESTAMP
                )
                """
            )
        )
    return engine


def test_legacy_sqlite_database_is_backed_up_and_upgraded(tmp_path: Path) -> None:
    backend_dir = tmp_path / "backend"
    backend_dir.mkdir()
    database_path = backend_dir / "legacy.db"
    engine = create_legacy_database(database_path)

    backup_path = upgrade_sqlite_schema(engine, allowed_root=backend_dir)
    assert backup_path is not None
    assert backup_path.exists()
    assert backup_path.parent == backend_dir

    Base.metadata.create_all(engine)
    columns = {item["name"] for item in inspect(engine).get_columns("notices")}
    assert {"matter_id", "extracted_json"}.issubset(columns)

    with Session(engine) as session:
        legacy = session.get(Notice, "legacy_notice")
        assert legacy is not None
        assert legacy.raw_text == "旧通知原文"
        session.add(Notice(id="new_notice", raw_text="新通知正文"))
        session.commit()
        assert session.scalar(select(Notice.id).where(Notice.id == "new_notice"))

    assert upgrade_sqlite_schema(engine, allowed_root=backend_dir) is None
    assert len(list(backend_dir.glob("legacy.backup-*.db"))) == 1
    engine.dispose()


def test_upgrade_refuses_database_outside_allowed_root(tmp_path: Path) -> None:
    allowed_root = tmp_path / "repo" / "backend"
    allowed_root.mkdir(parents=True)
    database_path = tmp_path / "outside.db"
    engine = create_legacy_database(database_path)

    with pytest.raises(RuntimeError, match="outside"):
        upgrade_sqlite_schema(engine, allowed_root=allowed_root)

    columns = {item["name"] for item in inspect(engine).get_columns("notices")}
    assert "matter_id" not in columns
    assert not list(tmp_path.glob("outside.backup-*.db"))
    engine.dispose()
