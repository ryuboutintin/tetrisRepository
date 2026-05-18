import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = "hyunhong-secret-key-please-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

app = FastAPI(title="hyunhong의 FastAPI 서버", version="1.0.0")

DB_PATH = "memos.db"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


# ── DB ───────────────────────────────────────────────────────────────────────

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                title   TEXT NOT NULL,
                content TEXT,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                name    TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                UNIQUE (name, user_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memo_tags (
                memo_id INTEGER NOT NULL,
                tag_id  INTEGER NOT NULL,
                PRIMARY KEY (memo_id, tag_id),
                FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
            )
        """)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Memo(BaseModel):
    title: str
    content: Optional[str] = None
    tags: list[str] = []

class MemoResponse(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    tags: list[str] = []


# ── Tag helpers ───────────────────────────────────────────────────────────────

def get_memo_tags(conn, memo_id: int) -> list[str]:
    rows = conn.execute(
        "SELECT t.name FROM tags t JOIN memo_tags mt ON t.id = mt.tag_id WHERE mt.memo_id = ? ORDER BY t.name",
        (memo_id,),
    ).fetchall()
    return [row["name"] for row in rows]


def set_memo_tags(conn, memo_id: int, tag_names: list[str], user_id: int):
    conn.execute("DELETE FROM memo_tags WHERE memo_id = ?", (memo_id,))
    for raw in tag_names:
        name = raw.strip()
        if not name:
            continue
        conn.execute("INSERT OR IGNORE INTO tags (name, user_id) VALUES (?, ?)", (name, user_id))
        tag = conn.execute(
            "SELECT id FROM tags WHERE name = ? AND user_id = ?", (name, user_id)
        ).fetchone()
        conn.execute("INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)", (memo_id, tag["id"]))


# ── Auth helpers ──────────────────────────────────────────────────────────────

def create_access_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> int:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    with get_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row is None:
        raise credentials_exception
    return row["id"]


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    init_db()


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/auth/register", status_code=201)
def register(user: UserCreate):
    with get_db() as conn:
        if conn.execute("SELECT id FROM users WHERE username = ?", (user.username,)).fetchone():
            raise HTTPException(status_code=400, detail="이미 존재하는 사용자입니다")
        conn.execute(
            "INSERT INTO users (username, hashed_password) VALUES (?, ?)",
            (user.username, pwd_context.hash(user.password)),
        )
    return {"message": "회원가입 완료"}


@app.post("/auth/token", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        row = conn.execute("SELECT hashed_password FROM users WHERE username = ?", (form.username,)).fetchone()
    if row is None or not pwd_context.verify(form.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다")
    return {"access_token": create_access_token(form.username), "token_type": "bearer"}


# ── Tag endpoint ──────────────────────────────────────────────────────────────

@app.get("/api/tags", response_model=list[str])
def list_tags(user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT name FROM tags WHERE user_id = ? ORDER BY name", (user_id,)
        ).fetchall()
    return [row["name"] for row in rows]


# ── Memo endpoints ────────────────────────────────────────────────────────────

@app.get("/api/memos", response_model=list[MemoResponse])
def list_memos(tag: Optional[str] = Query(None), user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        if tag:
            rows = conn.execute("""
                SELECT DISTINCT m.id, m.title, m.content
                FROM memos m
                JOIN memo_tags mt ON m.id = mt.memo_id
                JOIN tags t ON mt.tag_id = t.id
                WHERE m.user_id = ? AND t.name = ?
            """, (user_id, tag)).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title, content FROM memos WHERE user_id = ?", (user_id,)
            ).fetchall()
        return [{"id": r["id"], "title": r["title"], "content": r["content"],
                 "tags": get_memo_tags(conn, r["id"])} for r in rows]


@app.post("/api/memos", response_model=MemoResponse, status_code=201)
def create_memo(memo: Memo, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (title, content, user_id) VALUES (?, ?, ?)",
            (memo.title, memo.content, user_id),
        )
        memo_id = cur.lastrowid
        set_memo_tags(conn, memo_id, memo.tags, user_id)
        row = conn.execute("SELECT id, title, content FROM memos WHERE id = ?", (memo_id,)).fetchone()
        return {"id": row["id"], "title": row["title"], "content": row["content"],
                "tags": get_memo_tags(conn, memo_id)}


@app.get("/api/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, title, content FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
        return {"id": row["id"], "title": row["title"], "content": row["content"],
                "tags": get_memo_tags(conn, memo_id)}


@app.put("/api/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, memo: Memo, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        affected = conn.execute(
            "UPDATE memos SET title = ?, content = ? WHERE id = ? AND user_id = ?",
            (memo.title, memo.content, memo_id, user_id),
        ).rowcount
        if affected == 0:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
        set_memo_tags(conn, memo_id, memo.tags, user_id)
        row = conn.execute("SELECT id, title, content FROM memos WHERE id = ?", (memo_id,)).fetchone()
        return {"id": row["id"], "title": row["title"], "content": row["content"],
                "tags": get_memo_tags(conn, memo_id)}


@app.delete("/api/memos/{memo_id}")
def delete_memo(memo_id: int, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        affected = conn.execute(
            "DELETE FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
        ).rowcount
    if affected == 0:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return {"message": f"메모 {memo_id} 삭제 완료"}


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")
