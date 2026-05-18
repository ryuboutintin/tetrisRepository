import os
import sqlite3
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "memos.db")


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                title   TEXT NOT NULL,
                content TEXT NOT NULL
            )
        """)


init_db()

app = FastAPI(title="메모장 API", description="SQLite-backed CRUD API for memos")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


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


@app.get("/memos", response_model=list[MemoResponse])
def list_memos(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("SELECT id, title, content FROM memos").fetchall()
    return [dict(row) for row in rows]


@app.get("/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, title, content FROM memos WHERE id = ?", (memo_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return dict(row)


@app.post("/memos", response_model=MemoResponse, status_code=201)
def create_memo(body: MemoCreate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.execute(
        "INSERT INTO memos (title, content) VALUES (?, ?)",
        (body.title, body.content),
    )
    db.commit()
    row = db.execute(
        "SELECT id, title, content FROM memos WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return dict(row)


@app.put("/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, body: MemoUpdate, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, title, content FROM memos WHERE id = ?", (memo_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    current = dict(row)
    new_title = body.title if body.title is not None else current["title"]
    new_content = body.content if body.content is not None else current["content"]
    db.execute(
        "UPDATE memos SET title = ?, content = ? WHERE id = ?",
        (new_title, new_content, memo_id),
    )
    db.commit()
    updated = db.execute(
        "SELECT id, title, content FROM memos WHERE id = ?", (memo_id,)
    ).fetchone()
    return dict(updated)


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id FROM memos WHERE id = ?", (memo_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    db.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    db.commit()


@app.get("/")
def root():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")
