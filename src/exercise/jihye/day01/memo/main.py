from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "memo.db"
STATIC_DIR = BASE_DIR / "static"
JWT_SECRET = os.environ.get("MEMO_JWT_SECRET", "dev-only-change-me")
JWT_ISSUER = "memo-app"
JWT_TTL_SECONDS = 60 * 60 * 24
PASSWORD_ITERATIONS = 120_000


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db() -> None:
    with closing(get_connection()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
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
                kind TEXT NOT NULL DEFAULT 'memo',
                is_done INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        ensure_column(conn, "memos", "user_id", "user_id INTEGER")
        ensure_column(conn, "memos", "category", "category TEXT NOT NULL DEFAULT ''")
        ensure_column(conn, "memos", "tags", "tags TEXT NOT NULL DEFAULT '[]'")
        ensure_column(conn, "memos", "kind", "kind TEXT NOT NULL DEFAULT 'memo'")
        ensure_column(conn, "memos", "is_done", "is_done INTEGER NOT NULL DEFAULT 0")
        conn.commit()


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def jwt_encode(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_part = b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_part = b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_part}.{payload_part}".encode()
    signature = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_part}.{payload_part}.{b64url_encode(signature)}"


def jwt_decode(token: str) -> dict:
    try:
        header_part, payload_part, signature_part = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    signing_input = f"{header_part}.{payload_part}".encode()
    expected_signature = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()

    try:
        actual_signature = b64url_decode(signature_part)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    payload = json.loads(b64url_decode(payload_part))
    if payload.get("iss") != JWT_ISSUER:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    return payload


def hash_password(password: str, salt_hex: str | None = None) -> str:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, hash_hex = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt_hex), stored)


def normalize_tags(tags: list[str]) -> list[str]:
    normalized: list[str] = []
    for tag in tags:
        cleaned = tag.strip()
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
    return normalized


def tags_from_row(raw: str) -> list[str]:
    try:
        parsed = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed]


def memo_from_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "category": row["category"] or "",
        "tags": tags_from_row(row["tags"]),
        "kind": row["kind"] or "memo",
        "is_done": bool(row["is_done"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def create_access_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "iss": JWT_ISSUER,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_TTL_SECONDS,
    }
    return jwt_encode(payload)


class AuthPayload(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=4, max_length=128)


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class UserOut(BaseModel):
    id: int
    username: str


class MemoBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=5000)
    category: str = Field(default="", max_length=80)
    tags: list[str] = Field(default_factory=list)
    kind: Literal["memo", "todo"] = "memo"
    is_done: bool = False


class MemoCreate(MemoBase):
    pass


class MemoUpdate(MemoBase):
    pass


class MemoOut(MemoBase):
    id: int
    created_at: str
    updated_at: str


app = FastAPI(title="Memo App")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


def get_current_user(authorization: str | None = Header(default=None)) -> sqlite3.Row:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = authorization.removeprefix("Bearer ").strip()
    payload = jwt_decode(token)
    user_id = int(payload["sub"])

    with closing(get_connection()) as conn:
        user = conn.execute(
            "SELECT id, username, password_hash, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


def memo_row_or_404(conn: sqlite3.Connection, memo_id: int, user_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT id, user_id, title, content, category, tags, kind, is_done, created_at, updated_at
        FROM memos
        WHERE id = ? AND user_id = ?
        """,
        (memo_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return row


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
def register(payload: AuthPayload) -> AuthResponse:
    username = payload.username.strip()
    with closing(get_connection()) as conn:
        exists = conn.execute(
            "SELECT 1 FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Username already exists")

        password_hash = hash_password(payload.password)
        timestamp = now_iso()
        cursor = conn.execute(
            """
            INSERT INTO users (username, password_hash, created_at)
            VALUES (?, ?, ?)
            """,
            (username, password_hash, timestamp),
        )
        conn.commit()
        user_id = cursor.lastrowid

    token = create_access_token(user_id, username)
    return AuthResponse(token=token, user={"id": user_id, "username": username})


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: AuthPayload) -> AuthResponse:
    username = payload.username.strip()
    with closing(get_connection()) as conn:
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()

    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user["id"], user["username"])
    return AuthResponse(token=token, user={"id": user["id"], "username": user["username"]})


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: sqlite3.Row = Depends(get_current_user)) -> UserOut:
    return UserOut(id=current_user["id"], username=current_user["username"])


@app.get("/api/memos", response_model=list[MemoOut])
def list_memos(current_user: sqlite3.Row = Depends(get_current_user)) -> list[MemoOut]:
    with closing(get_connection()) as conn:
        rows = conn.execute(
            """
            SELECT id, title, content, category, tags, kind, is_done, created_at, updated_at
            FROM memos
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (current_user["id"],),
        ).fetchall()
    return [MemoOut(**memo_from_row(row)) for row in rows]


@app.post("/api/memos", response_model=MemoOut, status_code=201)
def create_memo(
    payload: MemoCreate,
    current_user: sqlite3.Row = Depends(get_current_user),
) -> MemoOut:
    timestamp = now_iso()
    tags_json = json.dumps(normalize_tags(payload.tags), ensure_ascii=False)
    with closing(get_connection()) as conn:
        cursor = conn.execute(
            """
            INSERT INTO memos (user_id, title, content, category, tags, kind, is_done, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["id"],
                payload.title.strip(),
                payload.content.strip(),
                payload.category.strip(),
                tags_json,
                payload.kind,
                int(payload.is_done),
                timestamp,
                timestamp,
            ),
        )
        conn.commit()
        row = memo_row_or_404(conn, cursor.lastrowid, current_user["id"])
    return MemoOut(**memo_from_row(row))


@app.get("/api/memos/{memo_id}", response_model=MemoOut)
def get_memo(
    memo_id: int,
    current_user: sqlite3.Row = Depends(get_current_user),
) -> MemoOut:
    with closing(get_connection()) as conn:
        row = memo_row_or_404(conn, memo_id, current_user["id"])
    return MemoOut(**memo_from_row(row))


@app.put("/api/memos/{memo_id}", response_model=MemoOut)
def update_memo(
    memo_id: int,
    payload: MemoUpdate,
    current_user: sqlite3.Row = Depends(get_current_user),
) -> MemoOut:
    timestamp = now_iso()
    tags_json = json.dumps(normalize_tags(payload.tags), ensure_ascii=False)
    with closing(get_connection()) as conn:
        conn.execute(
            """
            UPDATE memos
            SET title = ?, content = ?, category = ?, tags = ?, kind = ?, is_done = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                payload.title.strip(),
                payload.content.strip(),
                payload.category.strip(),
                tags_json,
                payload.kind,
                int(payload.is_done),
                timestamp,
                memo_id,
                current_user["id"],
            ),
        )
        conn.commit()
        row = memo_row_or_404(conn, memo_id, current_user["id"])
    return MemoOut(**memo_from_row(row))


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo(
    memo_id: int,
    current_user: sqlite3.Row = Depends(get_current_user),
) -> None:
    with closing(get_connection()) as conn:
        cursor = conn.execute(
            "DELETE FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user["id"]),
        )
        conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")
