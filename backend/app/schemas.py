from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NoticeFields(BaseModel):
    title: str | None = None
    raw_text: str = Field(min_length=1)
    source_name: str | None = None
    source_url: str | None = None
    published_at: datetime | None = None
    collected_by: str | None = None
    collected_at: datetime | None = None

    @field_validator("raw_text")
    @classmethod
    def require_nonblank_raw_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("raw_text cannot be blank")
        return value


class SeedNotice(NoticeFields):
    id: str = Field(min_length=1, max_length=120)


class NoticeCreate(NoticeFields):
    pass


class NoticeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str | None
    source_name: str | None
    published_at: datetime | None
    source_type: str
    parse_status: str


class NoticeDetail(NoticeSummary):
    raw_text: str
    source_url: str | None
    collected_by: str | None
    collected_at: datetime | None
    imported_at: datetime
    created_at: datetime
