import sqlite3
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="hyunhong의 FastAPI 서버", version="1.0.0")

DB_PATH = "memos.db"


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                title   TEXT NOT NULL,
                content TEXT
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


class Memo(BaseModel):
    title: str
    content: Optional[str] = None


class MemoResponse(Memo):
    id: int


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/memos", response_model=list[MemoResponse])
def list_memos():
    with get_db() as conn:
        rows = conn.execute("SELECT id, title, content FROM memos").fetchall()
    return [dict(row) for row in rows]


@app.post("/api/memos", response_model=MemoResponse, status_code=201)
def create_memo(memo: Memo):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (title, content) VALUES (?, ?)",
            (memo.title, memo.content),
        )
        row = conn.execute("SELECT id, title, content FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@app.get("/api/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT id, title, content FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return dict(row)


@app.put("/api/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, memo: Memo):
    with get_db() as conn:
        affected = conn.execute(
            "UPDATE memos SET title = ?, content = ? WHERE id = ?",
            (memo.title, memo.content, memo_id),
        ).rowcount
        if affected == 0:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
        row = conn.execute("SELECT id, title, content FROM memos WHERE id = ?", (memo_id,)).fetchone()
    return dict(row)


@app.delete("/api/memos/{memo_id}")
def delete_memo(memo_id: int):
    with get_db() as conn:
        affected = conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,)).rowcount
    if affected == 0:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return {"message": f"메모 {memo_id} 삭제 완료"}


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")
