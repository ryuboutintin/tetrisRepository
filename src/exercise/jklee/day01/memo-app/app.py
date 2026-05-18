from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


# ───────────────────────── database ─────────────────────────
DB_PATH = Path(__file__).parent / "memo.db"
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class MemoORM(Base):
    __tablename__ = "memos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str]
    content: Mapped[str] = mapped_column(default="")
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
    )


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ───────────────────────── schemas ─────────────────────────
class MemoIn(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = ""


class MemoOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ───────────────────────── app ─────────────────────────
app = FastAPI(title="Memo App API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_or_404(db: Session, memo_id: int) -> MemoORM:
    memo = db.get(MemoORM, memo_id)
    if memo is None:
        raise HTTPException(status_code=404, detail=f"Memo {memo_id} not found")
    return memo


@app.post("/memos", response_model=MemoOut, status_code=201)
def create_memo(payload: MemoIn, db: Session = Depends(get_db)) -> MemoORM:
    memo = MemoORM(title=payload.title, content=payload.content)
    db.add(memo)
    db.commit()
    db.refresh(memo)
    return memo


@app.get("/memos", response_model=List[MemoOut])
def list_memos(db: Session = Depends(get_db)) -> List[MemoORM]:
    return list(db.scalars(select(MemoORM).order_by(MemoORM.id)))


@app.get("/memos/{memo_id}", response_model=MemoOut)
def get_memo(memo_id: int, db: Session = Depends(get_db)) -> MemoORM:
    return get_or_404(db, memo_id)


@app.put("/memos/{memo_id}", response_model=MemoOut)
def update_memo(memo_id: int, payload: MemoIn, db: Session = Depends(get_db)) -> MemoORM:
    memo = get_or_404(db, memo_id)
    memo.title = payload.title
    memo.content = payload.content
    db.commit()
    db.refresh(memo)
    return memo


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, db: Session = Depends(get_db)) -> None:
    memo = get_or_404(db, memo_id)
    db.delete(memo)
    db.commit()
