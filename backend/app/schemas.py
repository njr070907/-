import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.app.services.notice_processing import NoticeExtraction, VersionComparison


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
    matter_id: str | None


class NoticeDetail(NoticeSummary):
    raw_text: str
    source_url: str | None
    collected_by: str | None
    collected_at: datetime | None
    imported_at: datetime
    created_at: datetime
    extracted_json: dict[str, Any] | None


class MatterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=500)

    @field_validator("name")
    @classmethod
    def require_nonblank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("name cannot be blank")
        return value.strip()


class MatterSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime


class TaskDraft(BaseModel):
    stage: str = Field(min_length=1, max_length=255)
    deadline: str | None = None
    submit_channel: str = ""
    materials: list[str] = Field(default_factory=list)

    @field_validator("stage")
    @classmethod
    def require_nonblank_stage(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("stage cannot be blank")
        return value.strip()

    @field_validator("deadline")
    @classmethod
    def allow_only_complete_iso_deadline(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?", value):
            raise ValueError("deadline must include a four-digit year")
        return value


class NoticeConfirm(BaseModel):
    extraction: NoticeExtraction
    matter_id: str | None = None
    new_matter_name: str | None = Field(default=None, max_length=500)
    task: TaskDraft | None = None

    @model_validator(mode="after")
    def require_one_matter_choice(self) -> "NoticeConfirm":
        if bool(self.matter_id) == bool(self.new_matter_name and self.new_matter_name.strip()):
            raise ValueError("provide exactly one of matter_id or new_matter_name")
        if self.new_matter_name is not None:
            self.new_matter_name = self.new_matter_name.strip()
        return self


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    matter_id: str
    source_notice_id: str | None
    stage: str
    deadline: str | None
    submit_channel: str
    materials: list[str]
    confirmed: bool
    completed: bool
    created_at: datetime


class TaskUpdate(BaseModel):
    completed: bool


class MatterDetail(MatterSummary):
    notices: list[NoticeSummary]
    tasks: list[TaskRead]


class VersionComparisonRead(VersionComparison):
    previous_notice_id: str
    current_notice_id: str
