import json
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

SECRET_KEY = "change-this-secret-in-production-use-32-chars"
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS   = 7

app = FastAPI(title="메모장 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DB_PATH  = BASE_DIR / "memos.db"
STATIC   = BASE_DIR / "static" / "index.html"

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── DB ────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER,
                title      TEXT NOT NULL,
                content    TEXT NOT NULL DEFAULT '',
                category   TEXT NOT NULL DEFAULT '',
                tags       TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                token      TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        for sql in [
            "ALTER TABLE memos ADD COLUMN user_id INTEGER",
            "ALTER TABLE memos ADD COLUMN category TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE memos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
        ]:
            try:
                conn.execute(sql)
            except Exception:
                pass


init_db()


# ── 인증 헬퍼 ──────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(user_id: int) -> str:
    payload = {
        "sub":  str(user_id),
        "type": "access",
        "exp":  datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    token      = secrets.token_urlsafe(32)
    now        = datetime.utcnow().isoformat()
    expires_at = (datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (user_id, token, expires_at, now),
        )
    return token


def rotate_refresh_token(old_token: str) -> tuple[str, dict]:
    """기존 리프레시 토큰을 검증·삭제하고 새 토큰을 발급한다 (토큰 로테이션)."""
    now        = datetime.utcnow().isoformat()
    new_token  = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?",
            (old_token, now),
        ).fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="리프레시 토큰이 유효하지 않거나 만료됐습니다.",
            )
        user_id = row["user_id"]
        conn.execute("DELETE FROM refresh_tokens WHERE token = ?", (old_token,))
        conn.execute(
            "INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (user_id, new_token, expires_at, now),
        )

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용자를 찾을 수 없습니다.")
    return new_token, dict(user)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise exc
        user_id = payload.get("sub")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (int(user_id),)).fetchone()
    if not user:
        raise exc
    return dict(user)


# ── 모델 ──────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str


class TokenPair(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    username:      str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class MemoCreate(BaseModel):
    title:    str
    content:  str = ""
    category: str = ""
    tags:     list[str] = []


class MemoUpdate(BaseModel):
    title:    Optional[str] = None
    content:  Optional[str] = None
    category: Optional[str] = None
    tags:     Optional[list[str]] = None


class Memo(BaseModel):
    id:         int
    user_id:    Optional[int]
    title:      str
    content:    str
    category:   str
    tags:       list[str]
    created_at: str
    updated_at: str


def row_to_memo(row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    d.setdefault("category", "")
    d.setdefault("user_id", None)
    return d


# ── 인증 엔드포인트 ────────────────────────────────────────────
@app.post("/auth/register", status_code=201)
def register(body: UserCreate):
    if len(body.username.strip()) < 2:
        raise HTTPException(400, "사용자 이름은 2자 이상이어야 합니다.")
    if len(body.password) < 4:
        raise HTTPException(400, "비밀번호는 4자 이상이어야 합니다.")
    now = datetime.now().isoformat(timespec="seconds")
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                (body.username.strip(), hash_password(body.password), now),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "이미 사용 중인 사용자 이름입니다.")
    return {"message": "회원가입이 완료됐습니다."}


@app.post("/auth/login", response_model=TokenPair)
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (form.username,)
        ).fetchone()
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(401, "사용자 이름 또는 비밀번호가 틀립니다.")
    return {
        "access_token":  create_access_token(user["id"]),
        "refresh_token": create_refresh_token(user["id"]),
        "token_type":    "bearer",
        "username":      user["username"],
    }


@app.post("/auth/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest):
    """리프레시 토큰으로 새 액세스 토큰 + 새 리프레시 토큰을 발급한다."""
    new_refresh, user = rotate_refresh_token(body.refresh_token)
    return {
        "access_token":  create_access_token(user["id"]),
        "refresh_token": new_refresh,
        "token_type":    "bearer",
        "username":      user["username"],
    }


@app.post("/auth/logout", status_code=204)
def logout_route(body: LogoutRequest):
    """리프레시 토큰을 DB에서 삭제해 재사용을 막는다."""
    with get_db() as conn:
        conn.execute("DELETE FROM refresh_tokens WHERE token = ?", (body.refresh_token,))


@app.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"], "created_at": user["created_at"]}


# ── CRUD ──────────────────────────────────────────────────────
@app.get("/memos", response_model=list[Memo])
def list_memos(
    search:   Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    tag:      Optional[str] = Query(default=None),
    user: dict = Depends(get_current_user),
):
    sql = "SELECT * FROM memos WHERE user_id = ?"
    params: list = [user["id"]]
    if search:
        sql += " AND (title LIKE ? OR content LIKE ?)"
        kw = f"%{search}%"
        params += [kw, kw]
    if category:
        sql += " AND category = ?"
        params.append(category)
    if tag:
        sql += ' AND tags LIKE ?'
        params.append(f'%"{tag}"%')
    sql += " ORDER BY updated_at DESC"
    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [row_to_memo(r) for r in rows]


@app.post("/memos", response_model=Memo, status_code=201)
def create_memo(body: MemoCreate, user: dict = Depends(get_current_user)):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (user_id, title, content, category, tags, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user["id"], body.title, body.content, body.category,
             json.dumps(body.tags, ensure_ascii=False), now, now),
        )
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone()
    return row_to_memo(row)


@app.get("/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int, user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ? AND user_id = ?", (memo_id, user["id"])
        ).fetchone()
    if not row:
        raise HTTPException(404, "메모를 찾을 수 없습니다.")
    return row_to_memo(row)


@app.put("/memos/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, body: MemoUpdate, user: dict = Depends(get_current_user)):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ? AND user_id = ?", (memo_id, user["id"])
        ).fetchone()
        if not row:
            raise HTTPException(404, "메모를 찾을 수 없습니다.")
        title    = body.title    if body.title    is not None else row["title"]
        content  = body.content  if body.content  is not None else row["content"]
        category = body.category if body.category is not None else row["category"]
        tags     = json.dumps(body.tags, ensure_ascii=False) if body.tags is not None else row["tags"]
        conn.execute(
            "UPDATE memos SET title=?, content=?, category=?, tags=?, updated_at=? WHERE id=?",
            (title, content, category, tags, now, memo_id),
        )
        updated = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    return row_to_memo(updated)


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, user: dict = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM memos WHERE id = ? AND user_id = ?", (memo_id, user["id"])
        ).fetchone()
        if not row:
            raise HTTPException(404, "메모를 찾을 수 없습니다.")
        conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))


@app.get("/categories")
def list_categories(user: dict = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT category FROM memos WHERE user_id = ? AND category != '' ORDER BY category",
            (user["id"],),
        ).fetchall()
    return [r["category"] for r in rows]


# ── 프론트엔드 ─────────────────────────────────────────────────
@app.get("/")
def serve_ui():
    return FileResponse(STATIC)
