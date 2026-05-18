from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os
import uuid
import shutil

app = FastAPI(title="Memo API")

BASE_DIR    = os.path.dirname(__file__)
DB_PATH     = os.path.join(BASE_DIR, "memos.db")
UPLOAD_DIR  = os.path.join(BASE_DIR, "static", "uploads")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

os.makedirs(UPLOAD_DIR, exist_ok=True)


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
            image_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # 기존 DB에 image_path 컬럼 추가 (이미 있으면 무시)
    try:
        conn.execute("ALTER TABLE memos ADD COLUMN image_path TEXT")
    except Exception:
        pass
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
    new_title   = memo.title   if memo.title   is not None else existing["title"]
    new_content = memo.content if memo.content is not None else existing["content"]

    conn.execute(
        "UPDATE memos SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (new_title, new_content, memo_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    conn.close()
    return dict(row)


@app.post("/api/memos/{memo_id}/image")
async def upload_image(memo_id: int, file: UploadFile = File(...)):
    conn = get_db()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Memo not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        conn.close()
        raise HTTPException(status_code=400, detail="허용되지 않는 파일 형식입니다.")

    # 기존 이미지 삭제
    existing = dict(row)
    if existing.get("image_path"):
        old_file = os.path.join(BASE_DIR, "static", existing["image_path"].lstrip("/static/"))
        if os.path.exists(old_file):
            os.remove(old_file)

    filename  = f"{memo_id}_{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, filename)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    image_path = f"/static/uploads/{filename}"
    conn.execute(
        "UPDATE memos SET image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (image_path, memo_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    conn.close()
    return dict(row)


@app.delete("/api/memos/{memo_id}/image", status_code=204)
def delete_image(memo_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Memo not found")

    existing = dict(row)
    if existing.get("image_path"):
        old_file = os.path.join(BASE_DIR, "static", existing["image_path"].lstrip("/static/"))
        if os.path.exists(old_file):
            os.remove(old_file)

    conn.execute(
        "UPDATE memos SET image_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (memo_id,),
    )
    conn.commit()
    conn.close()


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Memo not found")

    existing = dict(row)
    if existing.get("image_path"):
        old_file = os.path.join(BASE_DIR, "static", existing["image_path"].lstrip("/static/"))
        if os.path.exists(old_file):
            os.remove(old_file)

    conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    conn.commit()
    conn.close()


app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))
