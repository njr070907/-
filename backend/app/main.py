from contextlib import asynccontextmanager
from datetime import date, timedelta
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.app.config import CORS_ORIGINS
from backend.app.db import get_db, init_db
from backend.app.models import Matter, Notice, Task
from backend.app.schemas import (
    MatterCreate,
    MatterDetail,
    MatterSummary,
    NoticeConfirm,
    NoticeCreate,
    NoticeDetail,
    NoticeSummary,
    NoticeUpdate,
    TaskRead,
    TaskUpdate,
    VersionComparisonRead,
)
from backend.app.services.notice_processing import (
    NoticeExtraction,
    compare_notice_versions,
    extract_notice_fields,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="校事清 MVP API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/notices", response_model=list[NoticeSummary])
def list_notices(
    query: str | None = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
) -> list[Notice]:
    statement = select(Notice)
    if query and query.strip():
        keyword = f"%{query.strip()}%"
        statement = statement.where(
            or_(Notice.title.ilike(keyword), Notice.raw_text.ilike(keyword))
        )
    return list(db.scalars(statement.order_by(Notice.created_at.desc(), Notice.id.desc())))


@app.get("/api/notices/{notice_id}", response_model=NoticeDetail)
def get_notice(notice_id: str, db: Session = Depends(get_db)) -> Notice:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status_code=404, detail="Notice not found")
    return notice


@app.post("/api/notices", response_model=NoticeDetail, status_code=201)
def create_notice(payload: NoticeCreate, db: Session = Depends(get_db)) -> Notice:
    notice = Notice(
        id=f"notice_{uuid4().hex}",
        **payload.model_dump(),
        source_type="manual_copy",
        parse_status="raw",
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


def _notice_or_404(notice_id: str, db: Session) -> Notice:
    notice = db.get(Notice, notice_id)
    if notice is None:
        raise HTTPException(status_code=404, detail="Notice not found")
    return notice


def _matter_or_404(matter_id: str, db: Session) -> Matter:
    matter = db.get(Matter, matter_id)
    if matter is None:
        raise HTTPException(status_code=404, detail="Matter not found")
    return matter


@app.patch("/api/notices/{notice_id}", response_model=NoticeDetail)
def update_notice(
    notice_id: str, payload: NoticeUpdate, db: Session = Depends(get_db)
) -> Notice:
    notice = _notice_or_404(notice_id, db)
    if notice.parse_status == "confirmed":
        raise HTTPException(status_code=409, detail="Confirmed notice cannot be edited")
    notice.title = payload.title
    notice.raw_text = payload.raw_text
    notice.source_name = payload.source_name
    notice.source_url = payload.source_url
    notice.extracted_json = None
    notice.parse_status = "raw"
    db.commit()
    db.refresh(notice)
    return notice


@app.post("/api/notices/{notice_id}/extract", response_model=NoticeDetail)
def extract_notice(notice_id: str, db: Session = Depends(get_db)) -> Notice:
    notice = _notice_or_404(notice_id, db)
    extraction = extract_notice_fields(notice.raw_text)
    notice.extracted_json = extraction.model_dump(mode="json")
    notice.parse_status = "review_required"
    db.commit()
    db.refresh(notice)
    return notice


@app.post("/api/matters", response_model=MatterSummary, status_code=201)
def create_matter(payload: MatterCreate, db: Session = Depends(get_db)) -> Matter:
    matter = Matter(id=f"matter_{uuid4().hex}", name=payload.name)
    db.add(matter)
    db.commit()
    db.refresh(matter)
    return matter


@app.get("/api/matters", response_model=list[MatterSummary])
def list_matters(db: Session = Depends(get_db)) -> list[Matter]:
    return list(db.scalars(select(Matter).order_by(Matter.created_at.desc(), Matter.id.desc())))


@app.get("/api/matters/{matter_id}", response_model=MatterDetail)
def get_matter(matter_id: str, db: Session = Depends(get_db)) -> MatterDetail:
    matter = _matter_or_404(matter_id, db)
    notices = list(
        db.scalars(
            select(Notice)
            .where(Notice.matter_id == matter.id)
            .order_by(Notice.created_at.desc(), Notice.id.desc())
        )
    )
    tasks = list(
        db.scalars(
            select(Task).where(Task.matter_id == matter.id).order_by(Task.deadline, Task.id)
        )
    )
    return MatterDetail(
        id=matter.id,
        name=matter.name,
        created_at=matter.created_at,
        notices=[NoticeSummary.model_validate(notice) for notice in notices],
        tasks=[TaskRead.model_validate(task) for task in tasks],
    )


@app.get(
    "/api/matters/{matter_id}/compare", response_model=VersionComparisonRead
)
def compare_matter_notices(
    matter_id: str,
    previous_notice_id: str = Query(min_length=1, max_length=120),
    current_notice_id: str = Query(min_length=1, max_length=120),
    db: Session = Depends(get_db),
) -> VersionComparisonRead:
    _matter_or_404(matter_id, db)
    if previous_notice_id == current_notice_id:
        raise HTTPException(
            status_code=422, detail="Choose two different notices for comparison"
        )
    previous = _notice_or_404(previous_notice_id, db)
    current = _notice_or_404(current_notice_id, db)

    if previous.matter_id != matter_id or current.matter_id != matter_id:
        raise HTTPException(
            status_code=422, detail="Both notices must belong to the requested Matter"
        )
    if previous.parse_status != "confirmed" or current.parse_status != "confirmed":
        raise HTTPException(
            status_code=422, detail="Both notices must be confirmed before comparison"
        )
    if previous.extracted_json is None or current.extracted_json is None:
        raise HTTPException(
            status_code=422, detail="Both notices must have confirmed extraction data"
        )

    comparison = compare_notice_versions(
        NoticeExtraction.model_validate(previous.extracted_json),
        NoticeExtraction.model_validate(current.extracted_json),
    )
    return VersionComparisonRead(
        previous_notice_id=previous.id,
        current_notice_id=current.id,
        **comparison.model_dump(),
    )


@app.post("/api/notices/{notice_id}/confirm", response_model=NoticeDetail)
def confirm_notice(
    notice_id: str, payload: NoticeConfirm, db: Session = Depends(get_db)
) -> Notice:
    notice = _notice_or_404(notice_id, db)
    if payload.matter_id:
        matter = _matter_or_404(payload.matter_id, db)
    else:
        matter = Matter(
            id=f"matter_{uuid4().hex}",
            name=payload.new_matter_name or payload.extraction.matter_name,
        )
        db.add(matter)

    notice.matter_id = matter.id
    notice.extracted_json = payload.extraction.model_dump(mode="json")
    notice.parse_status = "confirmed"

    if payload.task is not None:
        task = db.scalar(select(Task).where(Task.source_notice_id == notice.id))
        if task is None:
            task = Task(
                id=f"task_{uuid4().hex}",
                matter_id=matter.id,
                source_notice_id=notice.id,
                stage=payload.task.stage,
                deadline=payload.task.deadline,
                submit_channel=payload.task.submit_channel,
                materials=payload.task.materials,
                confirmed=True,
            )
            db.add(task)
        else:
            task.matter_id = matter.id
            task.stage = payload.task.stage
            task.deadline = payload.task.deadline
            task.submit_channel = payload.task.submit_channel
            task.materials = payload.task.materials
            task.confirmed = True

    db.commit()
    db.refresh(notice)
    return notice


@app.post("/api/matters/{matter_id}/notices/{notice_id}", response_model=NoticeDetail)
def associate_notice_with_matter(
    matter_id: str, notice_id: str, db: Session = Depends(get_db)
) -> Notice:
    _matter_or_404(matter_id, db)
    notice = _notice_or_404(notice_id, db)
    notice.matter_id = matter_id
    db.commit()
    db.refresh(notice)
    return notice


@app.get("/api/tasks/week", response_model=list[TaskRead])
def list_week_tasks(
    start: date | None = Query(default=None), db: Session = Depends(get_db)
) -> list[Task]:
    week_start = start or date.today()
    week_end = week_start + timedelta(days=7)
    return list(
        db.scalars(
            select(Task)
            .where(
                Task.confirmed.is_(True),
                Task.deadline.is_not(None),
                Task.deadline >= week_start.isoformat(),
                Task.deadline < week_end.isoformat(),
            )
            .order_by(Task.deadline, Task.id)
        )
    )


@app.patch("/api/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    task.completed = payload.completed
    db.commit()
    db.refresh(task)
    return task
