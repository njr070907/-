from collections.abc import Generator
from datetime import datetime, timezone
from pathlib import Path
from shutil import copy2

from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.app.config import DATABASE_URL, PROJECT_ROOT


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite:") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


def _sqlite_file(bind: Engine) -> Path | None:
    if bind.dialect.name != "sqlite" or not bind.url.database:
        return None
    if bind.url.database == ":memory:":
        return None
    path = Path(bind.url.database)
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def _require_safe_database_path(database_path: Path, allowed_root: Path) -> None:
    try:
        database_path.relative_to(allowed_root.resolve())
    except ValueError as exc:
        raise RuntimeError(
            f"Refusing to upgrade SQLite database outside {allowed_root.resolve()}: "
            f"{database_path}"
        ) from exc


def upgrade_sqlite_schema(
    bind: Engine = engine, *, allowed_root: Path | None = None
) -> Path | None:
    """Upgrade the small local SQLite schema and return a backup path if changed."""
    database_path = _sqlite_file(bind)
    if database_path is None or not database_path.exists():
        return None

    inspector = inspect(bind)
    if "notices" not in inspector.get_table_names():
        return None

    columns = {column["name"] for column in inspector.get_columns("notices")}
    additions = []
    if "matter_id" not in columns:
        additions.append(
            "ALTER TABLE notices ADD COLUMN matter_id VARCHAR(120) "
            "REFERENCES matters(id)"
        )
    if "extracted_json" not in columns:
        additions.append("ALTER TABLE notices ADD COLUMN extracted_json JSON")
    if not additions:
        print("SQLite database schema is up to date.")
        return None

    safe_root = (allowed_root or (PROJECT_ROOT / "backend")).resolve()
    _require_safe_database_path(database_path, safe_root)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    backup_path = database_path.with_name(
        f"{database_path.stem}.backup-{timestamp}{database_path.suffix}"
    )
    copy2(database_path, backup_path)

    try:
        with bind.begin() as connection:
            for statement in additions:
                connection.execute(text(statement))
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_notices_matter_id "
                    "ON notices (matter_id)"
                )
            )
    except Exception as exc:
        raise RuntimeError(
            f"SQLite schema upgrade failed; original backup kept at {backup_path}"
        ) from exc

    added_names = [
        name for name in ("matter_id", "extracted_json") if name not in columns
    ]
    print(
        "SQLite schema upgraded: added "
        f"{', '.join(added_names)}; backup: {backup_path}"
    )
    return backup_path


def init_db() -> None:
    upgrade_sqlite_schema()
    Base.metadata.create_all(bind=engine)
