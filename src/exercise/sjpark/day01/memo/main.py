from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime, timezone
from typing import Optional

DATABASE_URL = "sqlite:///./memo.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class MemoModel(Base):
    __tablename__ = "memos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Memo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MemoCreate(BaseModel):
    title: str
    content: str = ""


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def read_root():
    return FileResponse("index.html")


@app.get("/memos", response_model=list[MemoResponse])
def list_memos():
    db = SessionLocal()
    try:
        return db.query(MemoModel).order_by(MemoModel.updated_at.desc()).all()
    finally:
        db.close()


@app.get("/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int):
    db = SessionLocal()
    try:
        memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
        if not memo:
            raise HTTPException(status_code=404, detail="Memo not found")
        return memo
    finally:
        db.close()


@app.post("/memos", response_model=MemoResponse, status_code=201)
def create_memo(body: MemoCreate):
    db = SessionLocal()
    try:
        memo = MemoModel(title=body.title, content=body.content)
        db.add(memo)
        db.commit()
        db.refresh(memo)
        return memo
    finally:
        db.close()


@app.put("/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, body: MemoUpdate):
    db = SessionLocal()
    try:
        memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
        if not memo:
            raise HTTPException(status_code=404, detail="Memo not found")
        if body.title is not None:
            memo.title = body.title
        if body.content is not None:
            memo.content = body.content
        memo.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(memo)
        return memo
    finally:
        db.close()


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    db = SessionLocal()
    try:
        memo = db.query(MemoModel).filter(MemoModel.id == memo_id).first()
        if not memo:
            raise HTTPException(status_code=404, detail="Memo not found")
        db.delete(memo)
        db.commit()
    finally:
        db.close()
