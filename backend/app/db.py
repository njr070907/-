from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.app.config import DATABASE_URL


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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    # Add nullable personalization fields to existing local SQLite databases.
    # Historical rows stay intact and null means unrestricted/unknown.
    if engine.dialect.name == "sqlite":
        existing = {column["name"] for column in inspect(engine).get_columns("notices")}
        additions = {
            "audience_roles": "JSON", "colleges": "JSON", "majors": "JSON",
            "grades": "JSON", "tags": "JSON", "deadline": "DATETIME",
            "importance": "VARCHAR(20)", "required": "BOOLEAN",
        }
        with engine.begin() as connection:
            for name, sql_type in additions.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE notices ADD COLUMN {name} {sql_type}"))
