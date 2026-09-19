import json
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


def main() -> int:
    init_db()
    result = import_directory(PROJECT_ROOT / "data" / "raw", SessionLocal)
    print(
        f"Scanned: {result.scanned}; imported: {result.imported}; "
        f"skipped: {result.skipped}; failed: {result.failed}"
    )
    return 1 if result.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
