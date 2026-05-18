from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os

app = FastAPI(title="Memo API")

DB_PATH = os.path.join(os.path.dirname(__file__), "memos.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS memos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


init_db()


class MemoCreate(BaseModel):
    title: str
    content: str


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


@app.get("/api/memos")
def list_memos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM memos ORDER BY updated_at DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/memos", status_code=201)
def create_memo(memo: MemoCreate):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO memos (title, content) VALUES (?, ?)",
        (memo.title, memo.content),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return dict(row)


@app.get("/api/memos/{memo_id}")
def get_memo(memo_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return dict(row)


@app.put("/api/memos/{memo_id}")
def update_memo(memo_id: int, memo: MemoUpdate):
    conn = get_db()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Memo not found")

    existing = dict(row)
    new_title = memo.title if memo.title is not None else existing["title"]
    new_content = memo.content if memo.content is not None else existing["content"]

    conn.execute(
        "UPDATE memos SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (new_title, new_content, memo_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    conn = get_db()
    row = conn.execute("SELECT id FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Memo not found")
    conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    conn.commit()
    conn.close()


app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(os.path.dirname(__file__), "static", "index.html"))
