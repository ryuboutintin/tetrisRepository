from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "memo.db"
JWT_SECRET = os.getenv("MEMO_JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 12
bearer_scheme = HTTPBearer(auto_error=False)


class UserCredentials(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "demo",
                "password": "demo1234",
            }
        }
    )

    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=4, max_length=128)


class User(BaseModel):
    id: int
    username: str
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class MemoBase(BaseModel):
    title: str = Field(min_length=1, max_length=100, examples=["팀 회의 메모"])
    content: str = Field(
        default="",
        max_length=5000,
        examples=["1. API 설계 검토\n2. 배포 일정 공유"],
    )
    category: str = Field(default="", max_length=50, examples=["업무"])
    tags: list[str] = Field(default_factory=list, examples=[["회의", "백엔드"]])


class MemoCreate(MemoBase):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "팀 회의 메모",
                "content": "1. API 설계 검토\n2. 배포 일정 공유",
                "category": "업무",
                "tags": ["회의", "백엔드"],
            }
        }
    )


class MemoUpdate(MemoBase):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "수정된 회의 메모",
                "content": "1. Swagger 테스트 완료\n2. UI 연결 확인 필요",
                "category": "개발",
                "tags": ["swagger", "문서"],
            }
        }
    )


class Memo(MemoBase):
    id: int
    created_at: str
    updated_at: str


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def column_exists(connection: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(row["name"] == column_name for row in rows)


def init_db() -> None:
    with closing(get_connection()) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS memos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
            """
        )
        if not column_exists(connection, "memos", "user_id"):
            connection.execute("ALTER TABLE memos ADD COLUMN user_id INTEGER")
        if not column_exists(connection, "memos", "category"):
            connection.execute("ALTER TABLE memos ADD COLUMN category TEXT NOT NULL DEFAULT ''")
        if not column_exists(connection, "memos", "tags"):
            connection.execute("ALTER TABLE memos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
        connection.commit()


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(user_id: int, username: str) -> str:
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": int((now + timedelta(minutes=TOKEN_EXPIRE_MINUTES)).timestamp()),
        "iat": int(now.timestamp()),
    }
    header_part = b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_part = b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_part}.{payload_part}".encode("ascii")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_part}.{payload_part}.{b64url_encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        header_part, payload_part, signature_part = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    signing_input = f"{header_part}.{payload_part}".encode("ascii")
    expected_signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(b64url_encode(expected_signature), signature_part):
        raise HTTPException(status_code=401, detail="Invalid token signature")

    try:
        payload = json.loads(b64url_decode(payload_part))
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token payload") from exc

    if payload.get("exp", 0) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail="Token has expired")
    return payload


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return f"{salt}${password_hash}"


def verify_password(password: str, stored_password_hash: str) -> bool:
    try:
        salt, password_hash = stored_password_hash.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return hmac.compare_digest(candidate, password_hash)


def normalize_tags(tags: list[str]) -> list[str]:
    unique_tags: list[str] = []
    seen: set[str] = set()
    for raw_tag in tags:
        cleaned = raw_tag.strip()
        if not cleaned:
            continue
        if len(cleaned) > 30:
            raise HTTPException(status_code=422, detail="Each tag must be 30 characters or fewer")
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_tags.append(cleaned)
    if len(unique_tags) > 10:
        raise HTTPException(status_code=422, detail="You can store up to 10 tags per memo")
    return unique_tags


def serialize_memo(row: sqlite3.Row) -> Memo:
    payload = dict(row)
    payload["tags"] = json.loads(payload["tags"] or "[]")
    return Memo(**payload)


def get_user_by_username(connection: sqlite3.Connection, username: str) -> sqlite3.Row | None:
    return connection.execute(
        """
        SELECT id, username, password_hash, created_at
        FROM users
        WHERE username = ?
        """,
        (username,),
    ).fetchone()


def build_auth_response(row: sqlite3.Row) -> AuthResponse:
    user = User(id=row["id"], username=row["username"], created_at=row["created_at"])
    return AuthResponse(
        access_token=create_access_token(user.id, user.username),
        user=user,
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    with closing(get_connection()) as connection:
        row = connection.execute(
            """
            SELECT id, username, created_at
            FROM users
            WHERE id = ?
            """,
            (int(user_id),),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**dict(row))


CurrentUser = Annotated[User, Depends(get_current_user)]


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(
    title="Memo CRUD API",
    description=(
        "간단한 메모 CRUD API입니다. `/docs`의 Swagger UI에서 "
        "회원가입, 로그인, 메모 생성, 조회, 수정, 삭제 요청을 직접 실행할 수 있습니다."
    ),
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "auth", "description": "회원가입 및 JWT 로그인 API"},
        {"name": "memos", "description": "인증된 사용자 전용 메모 CRUD API"},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.post(
    "/api/auth/register",
    response_model=AuthResponse,
    status_code=201,
    tags=["auth"],
    summary="회원가입",
    description="사용자를 생성하고 즉시 JWT 토큰을 발급합니다.",
)
def register(payload: UserCredentials) -> AuthResponse:
    username = payload.username.strip()
    with closing(get_connection()) as connection:
        existing_user = get_user_by_username(connection, username)
        if existing_user is not None:
            raise HTTPException(status_code=409, detail="Username already exists")
        connection.execute(
            """
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
            """,
            (username, hash_password(payload.password)),
        )
        connection.commit()
        row = get_user_by_username(connection, username)
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create user")
    return build_auth_response(row)


@app.post(
    "/api/auth/login",
    response_model=AuthResponse,
    tags=["auth"],
    summary="로그인",
    description="사용자 이름과 비밀번호를 검증한 뒤 JWT 토큰을 발급합니다.",
)
def login(payload: UserCredentials) -> AuthResponse:
    username = payload.username.strip()
    with closing(get_connection()) as connection:
        row = get_user_by_username(connection, username)
    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return build_auth_response(row)


@app.get(
    "/api/auth/me",
    response_model=User,
    tags=["auth"],
    summary="내 정보 조회",
    description="현재 토큰에 연결된 사용자 정보를 반환합니다.",
)
def me(current_user: CurrentUser) -> User:
    return current_user


@app.get(
    "/api/memos",
    response_model=list[Memo],
    tags=["memos"],
    summary="메모 목록 조회",
    description="현재 로그인한 사용자의 메모를 최근 수정 순으로 반환합니다.",
)
def list_memos(
    current_user: CurrentUser,
    category: str | None = Query(default=None, max_length=50),
    tag: str | None = Query(default=None, max_length=30),
) -> list[Memo]:
    sql = """
        SELECT id, title, content, category, tags, created_at, updated_at
        FROM memos
        WHERE user_id = ?
    """
    params: list[Any] = [current_user.id]
    if category:
        sql += " AND category = ?"
        params.append(category.strip())
    if tag:
        sql += " AND tags LIKE ?"
        params.append(f'%"{tag.strip()}"%')
    sql += " ORDER BY updated_at DESC, id DESC"

    with closing(get_connection()) as connection:
        rows = connection.execute(sql, tuple(params)).fetchall()
    return [serialize_memo(row) for row in rows]


@app.get(
    "/api/memos/{memo_id}",
    response_model=Memo,
    tags=["memos"],
    summary="메모 단건 조회",
    description="현재 로그인한 사용자의 메모만 조회할 수 있습니다.",
)
def get_memo(memo_id: int, current_user: CurrentUser) -> Memo:
    with closing(get_connection()) as connection:
        row = connection.execute(
            """
            SELECT id, title, content, category, tags, created_at, updated_at
            FROM memos
            WHERE id = ? AND user_id = ?
            """,
            (memo_id, current_user.id),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return serialize_memo(row)


@app.post(
    "/api/memos",
    response_model=Memo,
    status_code=201,
    tags=["memos"],
    summary="메모 생성",
    description="카테고리와 태그를 포함한 새 메모를 생성합니다.",
)
def create_memo(payload: MemoCreate, current_user: CurrentUser) -> Memo:
    category = payload.category.strip()
    tags = normalize_tags(payload.tags)
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO memos (user_id, title, content, category, tags)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                current_user.id,
                payload.title.strip(),
                payload.content.strip(),
                category,
                json.dumps(tags, ensure_ascii=False),
            ),
        )
        connection.commit()
        memo_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT id, title, content, category, tags, created_at, updated_at
            FROM memos
            WHERE id = ? AND user_id = ?
            """,
            (memo_id, current_user.id),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create memo")
    return serialize_memo(row)


@app.put(
    "/api/memos/{memo_id}",
    response_model=Memo,
    tags=["memos"],
    summary="메모 수정",
    description="현재 로그인한 사용자의 메모만 수정할 수 있습니다.",
)
def update_memo(memo_id: int, payload: MemoUpdate, current_user: CurrentUser) -> Memo:
    category = payload.category.strip()
    tags = normalize_tags(payload.tags)
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            UPDATE memos
            SET title = ?, content = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            """,
            (
                payload.title.strip(),
                payload.content.strip(),
                category,
                json.dumps(tags, ensure_ascii=False),
                memo_id,
                current_user.id,
            ),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")
        row = connection.execute(
            """
            SELECT id, title, content, category, tags, created_at, updated_at
            FROM memos
            WHERE id = ? AND user_id = ?
            """,
            (memo_id, current_user.id),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return serialize_memo(row)


@app.delete(
    "/api/memos/{memo_id}",
    status_code=204,
    tags=["memos"],
    summary="메모 삭제",
    description="현재 로그인한 사용자의 메모만 삭제할 수 있습니다.",
)
def delete_memo(memo_id: int, current_user: CurrentUser) -> None:
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            "DELETE FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user.id),
        )
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
