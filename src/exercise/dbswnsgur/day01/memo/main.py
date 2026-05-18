import sys
import os

# day01 디렉터리를 경로에 추가해 auth 패키지를 임포트
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import sqlite3
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

import auth.router as auth_module
from auth.jwt_utils import get_current_user

DB_PATH = "memo.db"
auth_module.DB_PATH = DB_PATH  # auth 패키지가 같은 DB를 사용하도록 설정

app = FastAPI(title="메모장 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_module.router)


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
    auth_module.init_users_table()
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL DEFAULT 0,
                title      TEXT    NOT NULL,
                content    TEXT    NOT NULL DEFAULT '',
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            )
        """)
        # 기존 테이블에 user_id 컬럼이 없으면 추가 (마이그레이션)
        cols = [r[1] for r in conn.execute("PRAGMA table_info(memos)").fetchall()]
        if "user_id" not in cols:
            conn.execute("ALTER TABLE memos ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0")

init_db()


class MemoCreate(BaseModel):
    title: str
    content: str


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class MemoResponse(BaseModel):
    id: int
    user_id: int
    title: str
    content: str
    created_at: str
    updated_at: str


@app.get("/memos", response_model=list[MemoResponse])
def list_memos(current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM memos WHERE user_id = ? ORDER BY id DESC",
            (current_user["id"],),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/memos", response_model=MemoResponse, status_code=201)
def create_memo(body: MemoCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now().isoformat()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (current_user["id"], body.title, body.content, now, now),
        )
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@app.get("/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user["id"]),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return dict(row)


@app.patch("/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, body: MemoUpdate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user["id"]),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
        memo = dict(row)
        new_title   = body.title   if body.title   is not None else memo["title"]
        new_content = body.content if body.content is not None else memo["content"]
        now = datetime.now().isoformat()
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (new_title, new_content, now, memo_id, current_user["id"]),
        )
        updated = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    return dict(updated)


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user["id"]),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
        conn.execute("DELETE FROM memos WHERE id = ? AND user_id = ?", (memo_id, current_user["id"]))
