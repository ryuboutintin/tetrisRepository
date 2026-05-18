from __future__ import annotations

import sqlite3
from collections.abc import AsyncIterator
from contextlib import closing
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "memo.db"


class MemoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(default="", max_length=5000)


class MemoUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(default="", max_length=5000)


class Memo(MemoCreate):
    id: int
    created_at: str
    updated_at: str


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with closing(get_connection()) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS memos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(title="Memo CRUD API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/memos", response_model=list[Memo])
def list_memos() -> list[Memo]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            ORDER BY updated_at DESC, id DESC
            """
        ).fetchall()
    return [Memo(**dict(row)) for row in rows]


@app.get("/api/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int) -> Memo:
    with closing(get_connection()) as connection:
        row = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (memo_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return Memo(**dict(row))


@app.post("/api/memos", response_model=Memo, status_code=201)
def create_memo(payload: MemoCreate) -> Memo:
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO memos (title, content)
            VALUES (?, ?)
            """,
            (payload.title.strip(), payload.content.strip()),
        )
        connection.commit()
        memo_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (memo_id,),
        ).fetchone()
    return Memo(**dict(row))


@app.put("/api/memos/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, payload: MemoUpdate) -> Memo:
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            UPDATE memos
            SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (payload.title.strip(), payload.content.strip(), memo_id),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")
        row = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (memo_id,),
        ).fetchone()
    return Memo(**dict(row))


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int) -> None:
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            "DELETE FROM memos WHERE id = ?",
            (memo_id,),
        )
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
