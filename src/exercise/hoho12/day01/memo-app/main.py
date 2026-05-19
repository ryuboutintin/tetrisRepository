import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

app = FastAPI(title="메모장 API")

DB_PATH = "memos.db"
SECRET_KEY = "kosa-vibecoding-2026-secret-key"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─── DB 초기화 ────────────────────────────────────────────────────
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


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    NOT NULL UNIQUE,
                password_hash TEXT    NOT NULL,
                created_at    TEXT    NOT NULL
            );
            CREATE TABLE IF NOT EXISTS categories (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name    TEXT    NOT NULL,
                color   TEXT    NOT NULL DEFAULT '#7c6af7',
                UNIQUE(user_id, name)
            );
            CREATE TABLE IF NOT EXISTS memos (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL REFERENCES users(id),
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                title       TEXT    NOT NULL DEFAULT '',
                content     TEXT    NOT NULL DEFAULT '',
                created_at  TEXT    NOT NULL,
                updated_at  TEXT    NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tags (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                name    TEXT    NOT NULL,
                UNIQUE(user_id, name)
            );
            CREATE TABLE IF NOT EXISTS memo_tags (
                memo_id INTEGER NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
                tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
                PRIMARY KEY (memo_id, tag_id)
            );
        """)
        # 기존 memos 테이블에 category_id 컬럼 추가 (마이그레이션)
        existing_cols = {r[1] for r in conn.execute("PRAGMA table_info(memos)")}
        if "category_id" not in existing_cols:
            conn.execute(
                "ALTER TABLE memos ADD COLUMN category_id INTEGER "
                "REFERENCES categories(id) ON DELETE SET NULL"
            )


@app.on_event("startup")
def startup():
    init_db()


# ─── 인증 헬퍼 ───────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")


# ─── 태그 헬퍼 ───────────────────────────────────────────────────
def get_memo_tags(conn, memo_id: int) -> list:
    rows = conn.execute("""
        SELECT t.name FROM tags t
        JOIN memo_tags mt ON mt.tag_id = t.id
        WHERE mt.memo_id = ? ORDER BY t.name
    """, (memo_id,)).fetchall()
    return [r["name"] for r in rows]


def set_memo_tags(conn, memo_id: int, user_id: int, tag_names: list):
    conn.execute("DELETE FROM memo_tags WHERE memo_id = ?", (memo_id,))
    for raw in tag_names:
        name = raw.strip().lower()
        if not name:
            continue
        row = conn.execute(
            "SELECT id FROM tags WHERE user_id = ? AND name = ?", (user_id, name)
        ).fetchone()
        tag_id = row["id"] if row else conn.execute(
            "INSERT INTO tags (user_id, name) VALUES (?, ?)", (user_id, name)
        ).lastrowid
        conn.execute(
            "INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)", (memo_id, tag_id)
        )


def row_to_memo(conn, row) -> dict:
    d = dict(row)
    d["tags"] = get_memo_tags(conn, d["id"])
    cat_id = d.get("category_id")
    if cat_id:
        cat = conn.execute(
            "SELECT name, color FROM categories WHERE id = ?", (cat_id,)
        ).fetchone()
        d["category_name"]  = cat["name"]  if cat else None
        d["category_color"] = cat["color"] if cat else None
    else:
        d["category_name"]  = None
        d["category_color"] = None
    return d


# ─── 스키마 ──────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CategoryCreate(BaseModel):
    name: str
    color: str = "#7c6af7"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    color: str


class MemoCreate(BaseModel):
    title: str
    content: str
    tags: list = []
    category_id: Optional[int] = None


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list] = None
    category_id: Optional[int] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    tags: list
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    created_at: str
    updated_at: str


# ─── 인증 엔드포인트 ──────────────────────────────────────────────
@app.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        if conn.execute("SELECT id FROM users WHERE username = ?", (body.username,)).fetchone():
            raise HTTPException(status_code=409, detail="이미 사용 중인 사용자명입니다.")
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (body.username, hash_password(body.password), now),
        )
    return {"access_token": create_token(cur.lastrowid)}


@app.post("/auth/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (form.username,)
        ).fetchone()
    if not row or not verify_password(form.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="사용자명 또는 비밀번호가 올바르지 않습니다.")
    return {"access_token": create_token(row["id"])}


# ─── 카테고리 CRUD ────────────────────────────────────────────────
@app.get("/categories", response_model=list[CategoryResponse])
def list_categories(user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, color FROM categories WHERE user_id = ? ORDER BY name", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(body: CategoryCreate, user_id: int = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "카테고리 이름을 입력하세요")
    try:
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)",
                (user_id, name, body.color),
            )
            return {"id": cur.lastrowid, "name": name, "color": body.color}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "이미 존재하는 카테고리 이름입니다")


@app.put("/categories/{cat_id}", response_model=CategoryResponse)
def update_category(cat_id: int, body: CategoryUpdate, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, name, color FROM categories WHERE id = ? AND user_id = ?",
            (cat_id, user_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "카테고리를 찾을 수 없습니다")
        name  = body.name.strip() if body.name  is not None else row["name"]
        color = body.color        if body.color is not None else row["color"]
        try:
            conn.execute(
                "UPDATE categories SET name = ?, color = ? WHERE id = ?", (name, color, cat_id)
            )
        except sqlite3.IntegrityError:
            raise HTTPException(409, "이미 존재하는 카테고리 이름입니다")
        return {"id": cat_id, "name": name, "color": color}


@app.delete("/categories/{cat_id}", status_code=204)
def delete_category(cat_id: int, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?", (cat_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(404, "카테고리를 찾을 수 없습니다")
        conn.execute("DELETE FROM categories WHERE id = ?", (cat_id,))


# ─── 메모 CRUD ───────────────────────────────────────────────────
@app.get("/memos", response_model=list[MemoResponse])
def list_memos(user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM memos WHERE user_id = ? ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
        return [row_to_memo(conn, r) for r in rows]


@app.post("/memos", response_model=MemoResponse, status_code=201)
def create_memo(body: MemoCreate, user_id: int = Depends(get_current_user)):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO memos (user_id, category_id, title, content, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, body.category_id, body.title, body.content, now, now),
        )
        memo_id = cur.lastrowid
        set_memo_tags(conn, memo_id, user_id, body.tags)
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
        return row_to_memo(conn, row)


@app.get("/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        return row_to_memo(conn, row)


@app.put("/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, body: MemoUpdate, user_id: int = Depends(get_current_user)):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        title   = body.title   if body.title   is not None else row["title"]
        content = body.content if body.content is not None else row["content"]
        # category_id: __fields_set__ 으로 "미전송"과 "명시적 null(해제)" 구분
        fields_set = getattr(body, "model_fields_set", None) or getattr(body, "__fields_set__", set())
        if "category_id" in fields_set:
            category_id = body.category_id
        else:
            category_id = row["category_id"]
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, category_id = ?, updated_at = ? WHERE id = ?",
            (title, content, category_id, now, memo_id),
        )
        if body.tags is not None:
            set_memo_tags(conn, memo_id, user_id, body.tags)
        updated = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
        return row_to_memo(conn, updated)


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
        conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))


# ─── 태그 목록 ───────────────────────────────────────────────────
@app.get("/tags")
def list_tags(user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT name FROM tags WHERE user_id = ? ORDER BY name", (user_id,)
        ).fetchall()
    return [r["name"] for r in rows]


# ─── 프론트엔드 서빙 ──────────────────────────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def index():
    return FileResponse("static/index.html")
