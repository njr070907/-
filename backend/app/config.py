import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import make_url


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def resolve_sqlite_url(url: str) -> str:
    """Resolve a relative SQLite path against the repository root.

    Otherwise ``sqlite:///./backend/app.db`` depends on the directory uvicorn is
    started from, and starting it inside ``backend/`` creates a second, empty
    ``backend/backend/app.db``.  Scripts/Reset-Demo.ps1 resolves it the same way.
    """
    parsed = make_url(url)
    database = parsed.database
    if (
        parsed.get_backend_name() != "sqlite"
        or not database
        or database == ":memory:"
        or parsed.query.get("uri")
        or Path(database).is_absolute()
    ):
        return url
    return parsed.set(database=(PROJECT_ROOT / database).as_posix()).render_as_string(
        hide_password=False
    )


DATABASE_URL = resolve_sqlite_url(os.getenv("DATABASE_URL", "sqlite:///./backend/app.db"))
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
