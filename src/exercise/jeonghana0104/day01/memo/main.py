from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import get_conn, init_db
from models import Memo, MemoCreate, MemoUpdate

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Claude Memo", version="1.0.0")


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/api/memos", response_model=list[Memo])
def list_memos() -> list[Memo]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos ORDER BY updated_at DESC"
        ).fetchall()
    return [Memo(**dict(row)) for row in rows]


@app.get("/api/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int) -> Memo:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos WHERE id = ?",
            (memo_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return Memo(**dict(row))


@app.post("/api/memos", response_model=Memo, status_code=201)
def create_memo(memo: MemoCreate) -> Memo:
    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO memos (title, content) VALUES (?, ?)",
            (memo.title, memo.content),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return Memo(**dict(row))


@app.put("/api/memos/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, memo: MemoUpdate) -> Memo:
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM memos WHERE id = ?", (memo_id,)
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Memo not found")
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
            (memo.title, memo.content, memo_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, title, content, created_at, updated_at FROM memos WHERE id = ?",
            (memo_id,),
        ).fetchone()
    return Memo(**dict(row))


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int) -> None:
    with get_conn() as conn:
        cursor = conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
