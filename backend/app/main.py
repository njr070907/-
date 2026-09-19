from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.app.config import CORS_ORIGINS
from backend.app.db import get_db, init_db
from backend.app.models import Notice
from backend.app.schemas import NoticeCreate, NoticeDetail, NoticeSummary


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="校事清 MVP API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
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
