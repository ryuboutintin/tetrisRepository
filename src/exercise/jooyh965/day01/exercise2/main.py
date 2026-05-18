from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from db import get_db, init_db

app = FastAPI(title="Memo API", version="0.2.0")

STATIC_DIR = Path(__file__).parent / "static"

init_db()


class MemoIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=10_000)


class MemoUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = Field(default=None, max_length=10_000)


class Memo(MemoIn):
    id: int
    created_at: datetime
    updated_at: datetime


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_memo(row) -> Memo:
    return Memo(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/memos", response_model=list[Memo])
def list_memos(db=Depends(get_db)):
    rows = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos ORDER BY id DESC"
    ).fetchall()
    return [_row_to_memo(r) for r in rows]


@app.get("/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int, db=Depends(get_db)):
    row = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos WHERE id = ?",
        (memo_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return _row_to_memo(row)


@app.post("/memos", response_model=Memo, status_code=status.HTTP_201_CREATED)
def create_memo(payload: MemoIn, db=Depends(get_db)):
    now = _now_iso()
    cur = db.execute(
        "INSERT INTO memos (title, content, created_at, updated_at) "
        "VALUES (?, ?, ?, ?)",
        (payload.title, payload.content, now, now),
    )
    row = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos WHERE id = ?",
        (cur.lastrowid,),
    ).fetchone()
    return _row_to_memo(row)


@app.put("/memos/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, payload: MemoUpdate, db=Depends(get_db)):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    existing = db.execute(
        "SELECT 1 FROM memos WHERE id = ?", (memo_id,)
    ).fetchone()
    if existing is None:
        raise HTTPException(status_code=404, detail="Memo not found")

    set_clause = ", ".join(f"{col} = ?" for col in updates)
    params = [*updates.values(), _now_iso(), memo_id]
    db.execute(
        f"UPDATE memos SET {set_clause}, updated_at = ? WHERE id = ?",
        params,
    )
    row = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos WHERE id = ?",
        (memo_id,),
    ).fetchone()
    return _row_to_memo(row)


@app.delete("/memos/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memo(memo_id: int, db=Depends(get_db)):
    cur = db.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")
    return None


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
