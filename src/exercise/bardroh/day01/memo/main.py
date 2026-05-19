import os
import sqlite3
import time
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "memos.db")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

CATEGORIES = ["업무", "개인", "아이디어", "기타"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                title    TEXT NOT NULL,
                content  TEXT NOT NULL,
                category TEXT
            )
        """)
        # 기존 DB에 category 컬럼이 없으면 추가 (하위 호환)
        try:
            conn.execute("ALTER TABLE memos ADD COLUMN category TEXT")
        except sqlite3.OperationalError:
            pass
        # user_id 컬럼 추가 (하위 호환)
        try:
            conn.execute("ALTER TABLE memos ADD COLUMN user_id INTEGER")
        except sqlite3.OperationalError:
            pass
        # 기존 메모(user_id IS NULL)를 첫 번째 가입 사용자에게 귀속
        conn.execute("""
            UPDATE memos
               SET user_id = (SELECT id FROM users ORDER BY id LIMIT 1)
             WHERE user_id IS NULL
               AND EXISTS (SELECT 1 FROM users LIMIT 1)
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT NOT NULL UNIQUE,
                email           TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
                created_at      INTEGER DEFAULT (strftime('%s', 'now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                token      TEXT NOT NULL UNIQUE,
                expires_at INTEGER NOT NULL,
                revoked    INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)


init_db()

app = FastAPI(title="메모장 API", description="SQLite-backed CRUD API for memos with JWT auth")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


# ─── Pydantic 모델 ─────────────────────────────────────────────────────────────

class MemoCreate(BaseModel):
    title: str
    content: str
    category: Optional[str] = None
    tags: list[str] = []


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None  # None = 변경 안 함, [] = 전체 제거


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    category: Optional[str] = None
    tags: list[str] = []


class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str


# ─── 메모 헬퍼 ─────────────────────────────────────────────────────────────────

_MEMO_SELECT = """
    SELECT m.id, m.title, m.content, m.category, m.user_id,
           GROUP_CONCAT(t.name) AS tag_names
    FROM memos m
    LEFT JOIN memo_tags mt ON m.id = mt.memo_id
    LEFT JOIN tags t       ON mt.tag_id = t.id
"""


def _row_to_memo(row: dict) -> dict:
    raw = row.pop("tag_names", None) or ""
    row["tags"] = [t.strip() for t in raw.split(",") if t.strip()]
    return row


def _fetch_memo(db: sqlite3.Connection, memo_id: int) -> Optional[dict]:
    row = db.execute(
        _MEMO_SELECT + " WHERE m.id = ? GROUP BY m.id", (memo_id,)
    ).fetchone()
    return _row_to_memo(dict(row)) if row else None


def _upsert_tags(db: sqlite3.Connection, memo_id: int, tag_names: list[str]):
    db.execute("DELETE FROM memo_tags WHERE memo_id = ?", (memo_id,))
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        db.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (name,))
        tag_id = db.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()["id"]
        db.execute(
            "INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)",
            (memo_id, tag_id),
        )


def _validate_category(category: Optional[str]):
    if category is not None and category not in CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"유효하지 않은 카테고리입니다. 허용값: {CATEGORIES}",
        )


# ─── 인증 헬퍼 ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "username": username, "exp": expire, "type": "access"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 유효하지 않거나 만료되었습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="잘못된 토큰 타입")
    return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    payload = decode_access_token(credentials.credentials)
    user_id = int(payload["sub"])
    row = db.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다")
    return dict(row)


# ─── 인증 엔드포인트 ───────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserResponse, status_code=201,
          summary="회원가입", tags=["auth"])
def register(body: UserRegister, db: sqlite3.Connection = Depends(get_db)):
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="비밀번호는 8자 이상이어야 합니다")
    if db.execute("SELECT id FROM users WHERE username = ?", (body.username,)).fetchone():
        raise HTTPException(status_code=409, detail="이미 사용 중인 username입니다")
    if db.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone():
        raise HTTPException(status_code=409, detail="이미 사용 중인 email입니다")
    hashed = hash_password(body.password)
    cursor = db.execute(
        "INSERT INTO users (username, email, hashed_password) VALUES (?, ?, ?)",
        (body.username, body.email, hashed),
    )
    db.commit()
    row = db.execute("SELECT id, username, email FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(row)


@app.post("/auth/login", response_model=TokenResponse,
          summary="로그인 — access token + refresh token 발급", tags=["auth"])
def login(body: UserLogin, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, username, hashed_password FROM users WHERE username = ?", (body.username,)
    ).fetchone()
    if row is None or not verify_password(body.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="username 또는 password가 올바르지 않습니다")
    access_token = create_access_token(row["id"], row["username"])
    refresh_token = secrets.token_urlsafe(64)
    expires_at = int(time.time()) + REFRESH_TOKEN_EXPIRE_DAYS * 86400
    db.execute(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (row["id"], refresh_token, expires_at),
    )
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@app.post("/auth/refresh", response_model=AccessTokenResponse,
          summary="refresh token으로 새 access token 발급", tags=["auth"])
def refresh(body: RefreshRequest, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token = ?",
        (body.refresh_token,),
    ).fetchone()
    if row is None or row["revoked"]:
        raise HTTPException(status_code=401, detail="유효하지 않은 refresh token입니다")
    if time.time() > row["expires_at"]:
        raise HTTPException(status_code=401, detail="refresh token이 만료되었습니다")
    user = db.execute("SELECT id, username FROM users WHERE id = ?", (row["user_id"],)).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다")
    return AccessTokenResponse(access_token=create_access_token(user["id"], user["username"]))


@app.post("/auth/logout", status_code=204,
          summary="로그아웃 — refresh token 무효화", tags=["auth"])
def logout(body: RefreshRequest, db: sqlite3.Connection = Depends(get_db)):
    db.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", (body.refresh_token,))
    db.commit()


@app.get("/auth/me", response_model=UserResponse,
         summary="내 정보 조회 (인증 필요)", tags=["auth"])
def me(current_user: dict = Depends(get_current_user)):
    return current_user


# ─── 카테고리 / 태그 엔드포인트 ───────────────────────────────────────────────

@app.get("/categories", response_model=list[str], tags=["memos"])
def list_categories(_: dict = Depends(get_current_user)):
    return CATEGORIES


@app.get("/tags", response_model=list[str], tags=["memos"])
def list_tags(
    _: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute("""
        SELECT DISTINCT t.name
        FROM tags t
        JOIN memo_tags mt ON t.id = mt.tag_id
        ORDER BY t.name
    """).fetchall()
    return [row["name"] for row in rows]


# ─── 메모 엔드포인트 (인증 필요) ───────────────────────────────────────────────

@app.get("/memos", response_model=list[MemoResponse], tags=["memos"])
def list_memos(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    rows = db.execute(
        _MEMO_SELECT + " WHERE m.user_id = ? GROUP BY m.id ORDER BY m.id DESC",
        (current_user["id"],),
    ).fetchall()
    return [_row_to_memo(dict(row)) for row in rows]


@app.get("/memos/{memo_id}", response_model=MemoResponse, tags=["memos"])
def get_memo(
    memo_id: int,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    memo = _fetch_memo(db, memo_id)
    if memo is None or memo["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return memo


@app.post("/memos", response_model=MemoResponse, status_code=201, tags=["memos"])
def create_memo(
    body: MemoCreate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    _validate_category(body.category)
    cursor = db.execute(
        "INSERT INTO memos (title, content, category, user_id) VALUES (?, ?, ?, ?)",
        (body.title, body.content, body.category, current_user["id"]),
    )
    memo_id = cursor.lastrowid
    _upsert_tags(db, memo_id, body.tags)
    db.commit()
    return _fetch_memo(db, memo_id)


@app.put("/memos/{memo_id}", response_model=MemoResponse, tags=["memos"])
def update_memo(
    memo_id: int,
    body: MemoUpdate,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    _validate_category(body.category)
    row = db.execute(
        "SELECT id, title, content, category, user_id FROM memos WHERE id = ?", (memo_id,)
    ).fetchone()
    if row is None or row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    cur = dict(row)
    db.execute(
        "UPDATE memos SET title = ?, content = ?, category = ? WHERE id = ?",
        (
            body.title    if body.title    is not None else cur["title"],
            body.content  if body.content  is not None else cur["content"],
            body.category if body.category is not None else cur["category"],
            memo_id,
        ),
    )
    if body.tags is not None:
        _upsert_tags(db, memo_id, body.tags)
    db.commit()
    return _fetch_memo(db, memo_id)


@app.delete("/memos/{memo_id}", status_code=204, tags=["memos"])
def delete_memo(
    memo_id: int,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT id, user_id FROM memos WHERE id = ?", (memo_id,)).fetchone()
    if row is None or row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    db.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    db.commit()


@app.get("/")
def root():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")
