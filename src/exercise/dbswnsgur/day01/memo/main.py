import sqlite3
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

DB_PATH = "memo.db"

app = FastAPI(title="메모장 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT    NOT NULL,
                content    TEXT    NOT NULL DEFAULT '',
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            )
        """)

init_db()


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


@app.get("/memos", response_model=list[MemoResponse])
def list_memos():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM memos ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


@app.post("/memos", response_model=MemoResponse, status_code=201)
def create_memo(body: MemoCreate):
    now = datetime.now().isoformat()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (body.title, body.content, now, now),
        )
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@app.get("/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return dict(row)


@app.patch("/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, body: MemoUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
        memo = dict(row)
        new_title   = body.title   if body.title   is not None else memo["title"]
        new_content = body.content if body.content is not None else memo["content"]
        now = datetime.now().isoformat()
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = ? WHERE id = ?",
            (new_title, new_content, now, memo_id),
        )
        updated = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    return dict(updated)


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM memos WHERE id = ?", (memo_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
        conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
