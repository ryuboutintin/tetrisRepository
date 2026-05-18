from contextlib import asynccontextmanager
from pathlib import Path
import sqlite3

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "memos.db"
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


class MemoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=2000)


class MemoUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=2000)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def normalize_memo(memo: MemoCreate | MemoUpdate) -> tuple[str, str]:
    title = memo.title.strip()
    content = memo.content.strip()
    if not title or not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title and content are required",
        )
    return title, content


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Memo CRUD API", lifespan=lifespan)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/api/memos")
async def list_memos():
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            ORDER BY id DESC
            """
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/api/memos", status_code=status.HTTP_201_CREATED)
async def create_memo(memo: MemoCreate):
    title, content = normalize_memo(memo)
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO memos (title, content) VALUES (?, ?)",
            (title, content),
        )
        row = conn.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return row_to_dict(row)


@app.put("/api/memos/{memo_id}")
async def update_memo(memo_id: int, memo: MemoUpdate):
    title, content = normalize_memo(memo)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE memos
            SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (title, content, memo_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")

        row = conn.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (memo_id,),
        ).fetchone()
    return row_to_dict(row)


@app.delete("/api/memos/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memo(memo_id: int):
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")
    return None
