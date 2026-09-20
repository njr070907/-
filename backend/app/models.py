from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    collected_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    source_type: Mapped[str] = mapped_column(String(50), default="manual_copy")
    parse_status: Mapped[str] = mapped_column(String(50), default="raw")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    audience_roles: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    colleges: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    majors: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    grades: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    importance: Mapped[str | None] = mapped_column(String(20), nullable=True)
    required: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
