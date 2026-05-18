from contextlib import asynccontextmanager
from datetime import datetime
from html import escape
from pathlib import Path
import sqlite3

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "memos.db"


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
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="FastAPI Memo CRUD", lifespan=lifespan)


class MemoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(default="", max_length=5000)


class MemoUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(default="", max_length=5000)


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def clean_title(title: str) -> str:
    cleaned = title.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Title is required")
    if len(cleaned) > 100:
        raise HTTPException(status_code=400, detail="Title must be 100 characters or less")
    return cleaned


def row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def find_memo_or_404(memo_id: int) -> dict:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return row_to_dict(row)


def render_page(memos: list[dict], editing: dict | None = None) -> str:
    edit_id = editing["id"] if editing else ""
    title = escape(editing["title"]) if editing else ""
    content = escape(editing["content"]) if editing else ""
    action = f"/memos/{edit_id}/edit" if editing else "/memos"
    button = "수정하기" if editing else "저장하기"
    cancel_link = '<a class="button secondary" href="/">취소</a>' if editing else ""

    memo_items = []
    for memo in memos:
        memo_items.append(
            f"""
            <article class="memo">
                <div class="memo-header">
                    <h2>{escape(memo["title"])}</h2>
                    <time>수정: {escape(memo["updated_at"])}</time>
                </div>
                <p>{escape(memo["content"]).replace(chr(10), "<br>")}</p>
                <div class="actions">
                    <a class="button secondary" href="/?edit={memo["id"]}">수정</a>
                    <form method="post" action="/memos/{memo["id"]}/delete">
                        <button class="button danger" type="submit">삭제</button>
                    </form>
                </div>
            </article>
            """
        )

    empty = '<p class="empty">아직 작성된 메모가 없습니다.</p>' if not memo_items else ""

    return f"""
    <!doctype html>
    <html lang="ko">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>FastAPI 메모장</title>
        <style>
            * {{ box-sizing: border-box; }}
            body {{
                margin: 0;
                font-family: Arial, "Noto Sans KR", sans-serif;
                color: #1f2937;
                background: #f5f7fb;
            }}
            header {{
                padding: 28px 20px;
                background: #ffffff;
                border-bottom: 1px solid #e5e7eb;
            }}
            header .inner, main {{
                width: min(960px, calc(100% - 32px));
                margin: 0 auto;
            }}
            h1 {{
                margin: 0;
                font-size: 28px;
            }}
            .subtitle {{
                margin: 8px 0 0;
                color: #6b7280;
            }}
            main {{
                display: grid;
                grid-template-columns: 320px 1fr;
                gap: 20px;
                padding: 24px 0 40px;
            }}
            .panel, .memo {{
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
            }}
            .panel {{
                align-self: start;
                padding: 18px;
            }}
            .panel h2 {{
                margin: 0 0 14px;
                font-size: 18px;
            }}
            label {{
                display: block;
                margin: 14px 0 6px;
                font-weight: 700;
            }}
            input, textarea {{
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font: inherit;
                background: #ffffff;
            }}
            textarea {{
                min-height: 180px;
                resize: vertical;
            }}
            .form-actions {{
                display: flex;
                gap: 8px;
                margin-top: 14px;
            }}
            .memo-list {{
                display: grid;
                gap: 14px;
            }}
            .memo {{
                padding: 18px;
            }}
            .memo-header {{
                display: flex;
                justify-content: space-between;
                gap: 12px;
                align-items: start;
            }}
            .memo h2 {{
                margin: 0;
                font-size: 20px;
                overflow-wrap: anywhere;
            }}
            time {{
                flex: none;
                color: #6b7280;
                font-size: 13px;
            }}
            .memo p {{
                margin: 12px 0 16px;
                line-height: 1.6;
                white-space: normal;
                overflow-wrap: anywhere;
            }}
            .actions {{
                display: flex;
                gap: 8px;
                align-items: center;
            }}
            .button {{
                display: inline-flex;
                justify-content: center;
                align-items: center;
                min-height: 38px;
                padding: 0 13px;
                border: 1px solid #2563eb;
                border-radius: 6px;
                background: #2563eb;
                color: #ffffff;
                font: inherit;
                text-decoration: none;
                cursor: pointer;
            }}
            .button.secondary {{
                border-color: #d1d5db;
                background: #ffffff;
                color: #374151;
            }}
            .button.danger {{
                border-color: #dc2626;
                background: #dc2626;
            }}
            .empty {{
                margin: 0;
                padding: 28px;
                border: 1px dashed #cbd5e1;
                border-radius: 8px;
                color: #6b7280;
                text-align: center;
                background: #ffffff;
            }}
            @media (max-width: 760px) {{
                main {{
                    grid-template-columns: 1fr;
                }}
                .memo-header {{
                    display: block;
                }}
                time {{
                    display: block;
                    margin-top: 6px;
                }}
            }}
        </style>
    </head>
    <body>
        <header>
            <div class="inner">
                <h1>FastAPI 메모장</h1>
                <p class="subtitle">메모를 작성하고, 목록에서 수정하거나 삭제할 수 있습니다.</p>
            </div>
        </header>
        <main>
            <section class="panel">
                <h2>{"메모 수정" if editing else "새 메모"}</h2>
                <form method="post" action="{action}">
                    <label for="title">제목</label>
                    <input id="title" name="title" value="{title}" maxlength="100" required>
                    <label for="content">내용</label>
                    <textarea id="content" name="content" maxlength="5000">{content}</textarea>
                    <div class="form-actions">
                        <button class="button" type="submit">{button}</button>
                        {cancel_link}
                    </div>
                </form>
            </section>
            <section class="memo-list" aria-label="메모 목록">
                {empty}
                {"".join(memo_items)}
            </section>
        </main>
    </body>
    </html>
    """


@app.get("/", response_class=HTMLResponse)
def index(edit: int | None = None):
    editing = find_memo_or_404(edit) if edit is not None else None
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM memos ORDER BY updated_at DESC, id DESC").fetchall()
    return HTMLResponse(render_page([row_to_dict(row) for row in rows], editing))


@app.get("/api/memos")
def list_memos():
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM memos ORDER BY updated_at DESC, id DESC").fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/api/memos", status_code=201)
def create_memo_api(memo: MemoCreate):
    timestamp = now_text()
    title = clean_title(memo.title)
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO memos (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (title, memo.content, timestamp, timestamp),
        )
    return find_memo_or_404(cursor.lastrowid)


@app.get("/api/memos/{memo_id}")
def get_memo(memo_id: int):
    return find_memo_or_404(memo_id)


@app.put("/api/memos/{memo_id}")
def update_memo_api(memo_id: int, memo: MemoUpdate):
    find_memo_or_404(memo_id)
    title = clean_title(memo.title)
    with get_connection() as conn:
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = ? WHERE id = ?",
            (title, memo.content, now_text(), memo_id),
        )
    return find_memo_or_404(memo_id)


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo_api(memo_id: int):
    find_memo_or_404(memo_id)
    with get_connection() as conn:
        conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    return None


@app.post("/memos")
def create_memo(title: str = Form(...), content: str = Form("")):
    timestamp = now_text()
    title = clean_title(title)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO memos (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (title, content, timestamp, timestamp),
        )
    return RedirectResponse("/", status_code=303)


@app.post("/memos/{memo_id}/edit")
def update_memo(memo_id: int, title: str = Form(...), content: str = Form("")):
    find_memo_or_404(memo_id)
    title = clean_title(title)
    with get_connection() as conn:
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = ? WHERE id = ?",
            (title, content, now_text(), memo_id),
        )
    return RedirectResponse("/", status_code=303)


@app.post("/memos/{memo_id}/delete")
def delete_memo(memo_id: int):
    find_memo_or_404(memo_id)
    with get_connection() as conn:
        conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    return RedirectResponse("/", status_code=303)
