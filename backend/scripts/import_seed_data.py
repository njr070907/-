import json
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from backend.app.config import PROJECT_ROOT
from backend.app.db import SessionLocal, init_db
from backend.app.models import Notice
from backend.app.schemas import SeedNotice


@dataclass
class ImportResult:
    scanned: int = 0
    imported: int = 0
    skipped: int = 0
    failed: int = 0


def import_directory(raw_dir: Path, sessions: sessionmaker[Session]) -> ImportResult:
    result = ImportResult()
    for path in sorted(raw_dir.glob("*.json")):
        result.scanned += 1
        try:
            payload = SeedNotice.model_validate(json.loads(path.read_text(encoding="utf-8")))
            with sessions.begin() as db:
                if db.get(Notice, payload.id) is not None:
                    result.skipped += 1
                    continue
                db.add(Notice(**payload.model_dump(), source_type="manual_copy", parse_status="raw"))
            result.imported += 1
        except (OSError, ValueError, ValidationError, SQLAlchemyError) as error:
            result.failed += 1
            print(f"ERROR {path.name}: {error}")
    return result


def import_demo_notices(path: Path, sessions: sessionmaker[Session]) -> ImportResult:
    result = ImportResult()
    records = json.loads(path.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    for record in records:
        result.scanned += 1
        values = dict(record)
        days = values.pop("deadline_in_days", None)
        values.update(source_name="校事清演示数据", published_at=now,
                      deadline=now + timedelta(days=days) if days is not None else None)
        try:
            payload = SeedNotice.model_validate(values)
            with sessions.begin() as db:
                if db.get(Notice, payload.id) is not None:
                    result.skipped += 1
                    continue
                db.add(Notice(**payload.model_dump(), source_type="manual_copy", parse_status="raw"))
            result.imported += 1
        except (ValueError, ValidationError, SQLAlchemyError) as error:
            result.failed += 1
            print(f"ERROR {values.get('id', 'unknown')}: {error}")
    return result


def main() -> int:
    init_db()
    result = import_directory(PROJECT_ROOT / "data" / "raw", SessionLocal)
    demo = import_demo_notices(PROJECT_ROOT / "data" / "demo_notices.json", SessionLocal)
    print(
        f"Scanned: {result.scanned}; imported: {result.imported}; "
        f"skipped: {result.skipped}; failed: {result.failed}"
    )
    print(f"Demo: scanned {demo.scanned}; imported {demo.imported}; skipped {demo.skipped}; failed {demo.failed}")
    return 1 if result.failed or demo.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
