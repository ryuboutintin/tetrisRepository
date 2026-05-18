from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "memo.db"
STATIC_DIR = BASE_DIR / "static"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with closing(get_connection()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


class MemoBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=5000)


class MemoCreate(MemoBase):
    pass


class MemoUpdate(MemoBase):
    pass


class MemoOut(MemoBase):
    id: int
    created_at: str
    updated_at: str


app = FastAPI(title="Memo App")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/memos", response_model=list[MemoOut])
def list_memos() -> list[MemoOut]:
    with closing(get_connection()) as conn:
        rows = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos ORDER BY id DESC"
        ).fetchall()
    return [MemoOut(**dict(row)) for row in rows]


@app.post("/api/memos", response_model=MemoOut, status_code=201)
def create_memo(payload: MemoCreate) -> MemoOut:
    timestamp = now_iso()
    with closing(get_connection()) as conn:
        cursor = conn.execute(
            """
            INSERT INTO memos (title, content, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (payload.title.strip(), payload.content.strip(), timestamp, timestamp),
        )
        conn.commit()
        memo_id = cursor.lastrowid

        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos WHERE id = ?",
            (memo_id,),
        ).fetchone()

    return MemoOut(**dict(row))


@app.get("/api/memos/{memo_id}", response_model=MemoOut)
def get_memo(memo_id: int) -> MemoOut:
    with closing(get_connection()) as conn:
        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos WHERE id = ?",
            (memo_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")

    return MemoOut(**dict(row))


@app.put("/api/memos/{memo_id}", response_model=MemoOut)
def update_memo(memo_id: int, payload: MemoUpdate) -> MemoOut:
    timestamp = now_iso()
    with closing(get_connection()) as conn:
        cursor = conn.execute(
            """
            UPDATE memos
            SET title = ?, content = ?, updated_at = ?
            WHERE id = ?
            """,
            (payload.title.strip(), payload.content.strip(), timestamp, memo_id),
        )
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")

        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos WHERE id = ?",
            (memo_id,),
        ).fetchone()

    return MemoOut(**dict(row))


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int) -> None:
    with closing(get_connection()) as conn:
        cursor = conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
        conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")
