import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── Database ──────────────────────────────────────────────────────────
DB_PATH = Path(__file__).parent / "memos.db"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            )
        """)
        conn.commit()


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ── Pydantic Schemas ──────────────────────────────────────────────────
class MemoCreate(BaseModel):
    title:   str
    content: str


class MemoUpdate(BaseModel):
    title:   Optional[str] = None
    content: Optional[str] = None


class MemoResponse(BaseModel):
    id:         int
    title:      str
    content:    str
    created_at: datetime
    updated_at: datetime


# ── App ───────────────────────────────────────────────────────────────
init_db()

app = FastAPI(
    title="메모장 API",
    description="FastAPI + SQLite(sqlite3)로 만든 메모 CRUD API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/static/index.html")


def _get_or_404(conn: sqlite3.Connection, memo_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return row


# ── Routes ────────────────────────────────────────────────────────────
@app.get("/memos", response_model=list[MemoResponse], summary="메모 목록 조회")
def list_memos(conn: sqlite3.Connection = Depends(get_conn)):
    rows = conn.execute("SELECT * FROM memos ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


@app.get("/memos/{memo_id}", response_model=MemoResponse, summary="메모 단건 조회")
def get_memo(memo_id: int, conn: sqlite3.Connection = Depends(get_conn)):
    return dict(_get_or_404(conn, memo_id))


@app.post("/memos", response_model=MemoResponse, status_code=201, summary="메모 생성")
def create_memo(data: MemoCreate, conn: sqlite3.Connection = Depends(get_conn)):
    now = datetime.now().isoformat()
    cur = conn.execute(
        "INSERT INTO memos (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (data.title, data.content, now, now),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@app.put("/memos/{memo_id}", response_model=MemoResponse, summary="메모 수정")
def update_memo(
    memo_id: int,
    data: MemoUpdate,
    conn: sqlite3.Connection = Depends(get_conn),
):
    _get_or_404(conn, memo_id)

    fields = data.model_dump(exclude_unset=True)
    fields["updated_at"] = datetime.now().isoformat()

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(
        f"UPDATE memos SET {set_clause} WHERE id = ?",
        (*fields.values(), memo_id),
    )
    conn.commit()
    return dict(conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone())


@app.delete("/memos/{memo_id}", status_code=204, summary="메모 삭제")
def delete_memo(memo_id: int, conn: sqlite3.Connection = Depends(get_conn)):
    _get_or_404(conn, memo_id)
    conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    conn.commit()


app.mount("/static", StaticFiles(directory="static"), name="static")
