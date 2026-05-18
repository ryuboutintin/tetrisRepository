import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="메모장 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DB_PATH  = BASE_DIR / "memos.db"
STATIC   = BASE_DIR / "static" / "index.html"


# ── DB ────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT NOT NULL,
                content    TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)


init_db()


# ── 모델 ──────────────────────────────────────────────────────
class MemoCreate(BaseModel):
    title:   str
    content: str = ""


class MemoUpdate(BaseModel):
    title:   Optional[str] = None
    content: Optional[str] = None


class Memo(BaseModel):
    id:         int
    title:      str
    content:    str
    created_at: str
    updated_at: str


# ── CRUD ──────────────────────────────────────────────────────
@app.get("/memos", response_model=list[Memo])
def list_memos(search: Optional[str] = Query(default=None, description="제목·내용 검색")):
    with get_db() as conn:
        if search:
            keyword = f"%{search}%"
            rows = conn.execute(
                "SELECT * FROM memos WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC",
                (keyword, keyword),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM memos ORDER BY updated_at DESC"
            ).fetchall()
    return [dict(r) for r in rows]


@app.post("/memos", response_model=Memo, status_code=201)
def create_memo(body: MemoCreate):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (body.title, body.content, now, now),
        )
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@app.get("/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return dict(row)


@app.put("/memos/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, body: MemoUpdate):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        title   = body.title   if body.title   is not None else row["title"]
        content = body.content if body.content is not None else row["content"]
        conn.execute(
            "UPDATE memos SET title=?, content=?, updated_at=? WHERE id=?",
            (title, content, now, memo_id),
        )
        updated = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    return dict(updated)


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM memos WHERE id = ?", (memo_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))


# ── 프론트엔드 ─────────────────────────────────────────────────
@app.get("/")
def serve_ui():
    return FileResponse(STATIC)
