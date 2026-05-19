from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import base64
import binascii
import hashlib
import hmac
import json
import os
from pathlib import Path
import sqlite3

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "memos.db"
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-for-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9가-힣_-]+$")
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class MemoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=2000)
    category: str = Field(default="", max_length=60)
    tags: list[str] = Field(default_factory=list, max_length=12)


class MemoUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=2000)
    category: str = Field(default="", max_length=60)
    tags: list[str] = Field(default_factory=list, max_length=12)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
            """
        )
        existing_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(memos)").fetchall()
        }
        migrations = {
            "user_id": "ALTER TABLE memos ADD COLUMN user_id INTEGER",
            "category": "ALTER TABLE memos ADD COLUMN category TEXT NOT NULL DEFAULT ''",
            "tags": "ALTER TABLE memos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
        }
        for column, statement in migrations.items():
            if column not in existing_columns:
                conn.execute(statement)


def row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "category": row["category"],
        "tags": json.loads(row["tags"] or "[]"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def normalize_memo(memo: MemoCreate | MemoUpdate) -> tuple[str, str, str, str]:
    title = memo.title.strip()
    content = memo.content.strip()
    if not title or not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Title and content are required",
        )
    category = memo.category.strip()
    tags = []
    for tag in memo.tags:
        normalized = tag.strip().lstrip("#")
        if normalized and normalized not in tags:
            tags.append(normalized[:30])
    return title, content, category, json.dumps(tags, ensure_ascii=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{base64.urlsafe_b64encode(salt).decode()}.{base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_value, digest_value = password_hash.split(".", 1)
        salt = base64.urlsafe_b64decode(salt_value.encode())
        expected = base64.urlsafe_b64decode(digest_value.encode())
    except (ValueError, binascii.Error):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return hmac.compare_digest(actual, expected)


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode())


def create_access_token(user_id: int, username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
        "iat": int(now.timestamp()),
    }
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    signing_input = ".".join(
        [
            b64url_encode(json.dumps(header, separators=(",", ":")).encode()),
            b64url_encode(json.dumps(payload, separators=(",", ":")).encode()),
        ]
    )
    signature = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{b64url_encode(signature)}"


def decode_access_token(token: str) -> dict:
    try:
        header_value, payload_value, signature_value = token.split(".")
        signing_input = f"{header_value}.{payload_value}"
        expected = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(b64url_decode(signature_value), expected):
            raise ValueError
        payload = json.loads(b64url_decode(payload_value))
        if payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError
        return payload
    except (ValueError, binascii.Error, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(authorization: str | None = Header(default=None)) -> sqlite3.Row:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(authorization.removeprefix("Bearer ").strip())
    with get_connection() as conn:
        user = conn.execute(
            "SELECT id, username FROM users WHERE id = ?",
            (payload["sub"],),
        ).fetchone()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Memo CRUD API", lifespan=lifespan)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    username = user.username.strip()
    with get_connection() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, hash_password(user.password)),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Username already exists")
    token = create_access_token(cursor.lastrowid, username)
    return {"access_token": token, "token_type": "bearer", "username": username}


@app.post("/api/auth/login")
async def login(user: UserLogin):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (user.username.strip(),),
        ).fetchone()
    if row is None or not verify_password(user.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(row["id"], row["username"])
    return {"access_token": token, "token_type": "bearer", "username": row["username"]}


@app.get("/api/auth/me")
async def me(current_user: sqlite3.Row = Depends(get_current_user)):
    return {"id": current_user["id"], "username": current_user["username"]}


@app.get("/api/memos")
async def list_memos(current_user: sqlite3.Row = Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, title, content, category, tags, created_at, updated_at
            FROM memos
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (current_user["id"],),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/api/memos", status_code=status.HTTP_201_CREATED)
async def create_memo(memo: MemoCreate, current_user: sqlite3.Row = Depends(get_current_user)):
    title, content, category, tags = normalize_memo(memo)
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO memos (user_id, title, content, category, tags) VALUES (?, ?, ?, ?, ?)",
            (current_user["id"], title, content, category, tags),
        )
        row = conn.execute(
            """
            SELECT id, title, content, category, tags, created_at, updated_at
            FROM memos
            WHERE id = ? AND user_id = ?
            """,
            (cursor.lastrowid, current_user["id"]),
        ).fetchone()
    return row_to_dict(row)


@app.put("/api/memos/{memo_id}")
async def update_memo(
    memo_id: int,
    memo: MemoUpdate,
    current_user: sqlite3.Row = Depends(get_current_user),
):
    title, content, category, tags = normalize_memo(memo)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE memos
            SET title = ?, content = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            """,
            (title, content, category, tags, memo_id, current_user["id"]),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")

        row = conn.execute(
            """
            SELECT id, title, content, category, tags, created_at, updated_at
            FROM memos
            WHERE id = ? AND user_id = ?
            """,
            (memo_id, current_user["id"]),
        ).fetchone()
    return row_to_dict(row)


@app.delete("/api/memos/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memo(memo_id: int, current_user: sqlite3.Row = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user["id"]),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")
    return None
