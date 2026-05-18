import sqlite3
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

app = FastAPI(title="메모장 API")

DB_PATH = "memos.db"

@app.on_event("startup")
def startup():
    init_db()


# ─── DB 초기화 ────────────────────────────────────────────────────
def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT    NOT NULL DEFAULT '',
                content    TEXT    NOT NULL DEFAULT '',
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            )
        """)

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# ─── 스키마 ──────────────────────────────────────────────────────
class MemoCreate(BaseModel):
    title: str
    content: str


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: str
    updated_at: str


def row_to_dict(row) -> dict:
    return dict(row)


# ─── CRUD 엔드포인트 ──────────────────────────────────────────────
@app.get("/memos", response_model=list[MemoResponse])
def list_memos():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM memos ORDER BY updated_at DESC").fetchall()
    return [row_to_dict(r) for r in rows]


@app.post("/memos", response_model=MemoResponse, status_code=201)
def create_memo(body: MemoCreate):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (body.title, body.content, now, now),
        )
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)


@app.get("/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return row_to_dict(row)


@app.put("/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, body: MemoUpdate):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        title = body.title if body.title is not None else row["title"]
        content = body.content if body.content is not None else row["content"]
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = ? WHERE id = ?",
            (title, content, now, memo_id),
        )
        updated = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    return row_to_dict(updated)


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM memos WHERE id = ?", (memo_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))


# ─── 프론트엔드 서빙 ──────────────────────────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")
