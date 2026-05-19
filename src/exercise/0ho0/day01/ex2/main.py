from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import base64
import hashlib
import hmac
from html import escape
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time

from fastapi import Cookie, Depends, FastAPI, Form, Header, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "memos.db"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-for-local-development")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
AUTH_COOKIE_NAME = "access_token"


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
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        columns = conn.execute("PRAGMA table_info(memos)").fetchall()
        if "user_id" not in {column["name"] for column in columns}:
            conn.execute("ALTER TABLE memos ADD COLUMN user_id INTEGER")


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


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=6, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def clean_title(title: str) -> str:
    cleaned = title.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Title is required")
    if len(cleaned) > 100:
        raise HTTPException(status_code=400, detail="Title must be 100 characters or less")
    return cleaned


def clean_username(username: str) -> str:
    cleaned = username.strip().lower()
    if len(cleaned) < 3 or len(cleaned) > 30:
        raise HTTPException(status_code=400, detail="Username must be 3-30 characters")
    if not all(char.isalnum() or char in {"_", "-"} for char in cleaned):
        raise HTTPException(status_code=400, detail="Username can only use letters, numbers, _ and -")
    return cleaned


def hash_password(password: str, salt: str | None = None) -> str:
    if salt is None:
        salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${password_hash.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_hash = stored_hash.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(hash_password(password, salt), f"{salt}${expected_hash}")


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def base64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(user: dict) -> str:
    expire_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "exp": int(expire_at.timestamp()),
    }
    signing_input = ".".join(
        [
            base64url_encode(json.dumps(header, separators=(",", ":")).encode()),
            base64url_encode(json.dumps(payload, separators=(",", ":")).encode()),
        ]
    )
    signature = hmac.new(JWT_SECRET_KEY.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{base64url_encode(signature)}"


def decode_access_token(token: str) -> dict:
    try:
        header_part, payload_part, signature_part = token.split(".")
        signing_input = f"{header_part}.{payload_part}"
        expected_signature = hmac.new(
            JWT_SECRET_KEY.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(base64url_decode(signature_part), expected_signature):
            raise ValueError
        header = json.loads(base64url_decode(header_part))
        payload = json.loads(base64url_decode(payload_part))
        if header.get("alg") != JWT_ALGORITHM:
            raise ValueError
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError
        return payload
    except (ValueError, json.JSONDecodeError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def find_user_by_username(username: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def find_user_by_id(user_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def register_user(username: str, password: str) -> dict:
    username = clean_username(username)
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    timestamp = now_text()
    try:
        with get_connection() as conn:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                (username, hash_password(password), timestamp),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = find_user_by_id(cursor.lastrowid)
    if user is None:
        raise HTTPException(status_code=500, detail="User registration failed")
    return user


def authenticate_user(username: str, password: str) -> dict:
    user = find_user_by_username(clean_username(username))
    if user is None or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return user


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> dict:
    token = extract_bearer_token(authorization) or access_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    user = find_user_by_id(int(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_page_user(request: Request) -> dict | RedirectResponse:
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        return RedirectResponse("/login", status_code=303)
    try:
        payload = decode_access_token(token)
        user = find_user_by_id(int(payload["sub"]))
    except HTTPException:
        user = None
    if user is None:
        response = RedirectResponse("/login", status_code=303)
        response.delete_cookie(AUTH_COOKIE_NAME)
        return response
    return user


def row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "title": row["title"],
        "content": row["content"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def find_memo_or_404(memo_id: int, user_id: int) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return row_to_dict(row)


def render_auth_page(mode: str, error: str | None = None) -> str:
    is_register = mode == "register"
    title = "회원가입" if is_register else "로그인"
    action = "/register" if is_register else "/login"
    switch_href = "/login" if is_register else "/register"
    switch_text = "이미 계정이 있나요? 로그인" if is_register else "계정이 없나요? 회원가입"
    error_html = f'<p class="error">{escape(error)}</p>' if error else ""

    return f"""
    <!doctype html>
    <html lang="ko">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{title} - FastAPI 메모장</title>
        <style>
            * {{ box-sizing: border-box; }}
            body {{
                min-height: 100vh;
                margin: 0;
                display: grid;
                place-items: center;
                font-family: Arial, "Noto Sans KR", sans-serif;
                color: #1f2937;
                background: #f5f7fb;
            }}
            main {{
                width: min(420px, calc(100% - 32px));
                padding: 24px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                background: #ffffff;
            }}
            h1 {{
                margin: 0 0 8px;
                font-size: 26px;
            }}
            p {{
                margin: 0 0 18px;
                color: #6b7280;
            }}
            .error {{
                padding: 10px 12px;
                border-radius: 6px;
                color: #991b1b;
                background: #fee2e2;
            }}
            label {{
                display: block;
                margin: 14px 0 6px;
                font-weight: 700;
            }}
            input {{
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font: inherit;
            }}
            button, a.button {{
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
            .actions {{
                display: flex;
                justify-content: space-between;
                gap: 8px;
                margin-top: 18px;
                align-items: center;
            }}
            a {{
                color: #2563eb;
                text-decoration: none;
            }}
        </style>
    </head>
    <body>
        <main>
            <h1>{title}</h1>
            <p>JWT 인증으로 내 메모만 관리합니다.</p>
            {error_html}
            <form method="post" action="{action}">
                <label for="username">아이디</label>
                <input id="username" name="username" autocomplete="username" required minlength="3" maxlength="30">
                <label for="password">비밀번호</label>
                <input id="password" name="password" type="password" autocomplete="current-password" required minlength="6">
                <div class="actions">
                    <button type="submit">{title}</button>
                    <a href="{switch_href}">{switch_text}</a>
                </div>
            </form>
        </main>
    </body>
    </html>
    """


def render_page(memos: list[dict], user: dict, editing: dict | None = None) -> str:
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
            .logout {{
                margin-top: 14px;
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
                <p class="subtitle">{escape(user["username"])}님의 메모를 작성하고, 수정하거나 삭제할 수 있습니다.</p>
                <form method="post" action="/logout" class="logout">
                    <button class="button secondary" type="submit">로그아웃</button>
                </form>
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
def index(request: Request, edit: int | None = None):
    user = require_page_user(request)
    if isinstance(user, RedirectResponse):
        return user
    editing = find_memo_or_404(edit, user["id"]) if edit is not None else None
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM memos WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
            (user["id"],),
        ).fetchall()
    return HTMLResponse(render_page([row_to_dict(row) for row in rows], user, editing))


@app.get("/login", response_class=HTMLResponse)
def login_page():
    return HTMLResponse(render_auth_page("login"))


@app.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    try:
        user = authenticate_user(username, password)
    except HTTPException as exc:
        return HTMLResponse(render_auth_page("login", exc.detail), status_code=exc.status_code)
    response = RedirectResponse("/", status_code=303)
    response.set_cookie(
        AUTH_COOKIE_NAME,
        create_access_token(user),
        httponly=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return response


@app.get("/register", response_class=HTMLResponse)
def register_page():
    return HTMLResponse(render_auth_page("register"))


@app.post("/register")
def register(username: str = Form(...), password: str = Form(...)):
    try:
        user = register_user(username, password)
    except HTTPException as exc:
        return HTMLResponse(render_auth_page("register", exc.detail), status_code=exc.status_code)
    response = RedirectResponse("/", status_code=303)
    response.set_cookie(
        AUTH_COOKIE_NAME,
        create_access_token(user),
        httponly=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return response


@app.post("/logout")
def logout():
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie(AUTH_COOKIE_NAME)
    return response


@app.post("/api/register", response_model=TokenResponse, status_code=201)
def register_api(user_create: UserCreate):
    user = register_user(user_create.username, user_create.password)
    return {"access_token": create_access_token(user), "token_type": "bearer"}


@app.post("/api/login", response_model=TokenResponse)
def login_api(user_create: UserCreate):
    user = authenticate_user(user_create.username, user_create.password)
    return {"access_token": create_access_token(user), "token_type": "bearer"}


@app.get("/api/memos")
def list_memos(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM memos WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
            (current_user["id"],),
        ).fetchall()
    return [row_to_dict(row) for row in rows]


@app.post("/api/memos", status_code=201)
def create_memo_api(memo: MemoCreate, current_user: dict = Depends(get_current_user)):
    timestamp = now_text()
    title = clean_title(memo.title)
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO memos (user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (current_user["id"], title, memo.content, timestamp, timestamp),
        )
    return find_memo_or_404(cursor.lastrowid, current_user["id"])


@app.get("/api/memos/{memo_id}")
def get_memo(memo_id: int, current_user: dict = Depends(get_current_user)):
    return find_memo_or_404(memo_id, current_user["id"])


@app.put("/api/memos/{memo_id}")
def update_memo_api(
    memo_id: int, memo: MemoUpdate, current_user: dict = Depends(get_current_user)
):
    find_memo_or_404(memo_id, current_user["id"])
    title = clean_title(memo.title)
    with get_connection() as conn:
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (title, memo.content, now_text(), memo_id, current_user["id"]),
        )
    return find_memo_or_404(memo_id, current_user["id"])


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo_api(memo_id: int, current_user: dict = Depends(get_current_user)):
    find_memo_or_404(memo_id, current_user["id"])
    with get_connection() as conn:
        conn.execute("DELETE FROM memos WHERE id = ? AND user_id = ?", (memo_id, current_user["id"]))
    return None


@app.post("/memos")
def create_memo(request: Request, title: str = Form(...), content: str = Form("")):
    user = require_page_user(request)
    if isinstance(user, RedirectResponse):
        return user
    timestamp = now_text()
    title = clean_title(title)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO memos (user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (user["id"], title, content, timestamp, timestamp),
        )
    return RedirectResponse("/", status_code=303)


@app.post("/memos/{memo_id}/edit")
def update_memo(request: Request, memo_id: int, title: str = Form(...), content: str = Form("")):
    user = require_page_user(request)
    if isinstance(user, RedirectResponse):
        return user
    find_memo_or_404(memo_id, user["id"])
    title = clean_title(title)
    with get_connection() as conn:
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (title, content, now_text(), memo_id, user["id"]),
        )
    return RedirectResponse("/", status_code=303)


@app.post("/memos/{memo_id}/delete")
def delete_memo(request: Request, memo_id: int):
    user = require_page_user(request)
    if isinstance(user, RedirectResponse):
        return user
    find_memo_or_404(memo_id, user["id"])
    with get_connection() as conn:
        conn.execute("DELETE FROM memos WHERE id = ? AND user_id = ?", (memo_id, user["id"]))
    return RedirectResponse("/", status_code=303)
