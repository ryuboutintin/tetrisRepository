import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────────────────
SECRET_KEY           = "change-this-secret-in-production"
ALGORITHM            = "HS256"
TOKEN_EXPIRE_MINUTES = 60

DB_PATH = Path(__file__).parent / "memos.db"

# ── Security ──────────────────────────────────────────────────────────
bearer = HTTPBearer()

def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_pw(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

# ── Database ──────────────────────────────────────────────────────────
def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT    NOT NULL UNIQUE,
                hashed_password TEXT    NOT NULL,
                created_at      TEXT    NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                name       TEXT    NOT NULL,
                created_at TEXT    NOT NULL,
                UNIQUE(user_id, name)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL REFERENCES users(id),
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                title       TEXT    NOT NULL,
                content     TEXT    NOT NULL,
                created_at  TEXT    NOT NULL,
                updated_at  TEXT    NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                name       TEXT    NOT NULL,
                created_at TEXT    NOT NULL,
                UNIQUE(user_id, name)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memo_tags (
                memo_id INTEGER NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
                tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
                PRIMARY KEY (memo_id, tag_id)
            )
        """)
        cols = [r[1] for r in conn.execute("PRAGMA table_info(memos)").fetchall()]
        if "user_id" not in cols:
            conn.execute("ALTER TABLE memos ADD COLUMN user_id INTEGER")
        if "category_id" not in cols:
            conn.execute("ALTER TABLE memos ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL")
        conn.commit()


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ── Pydantic Schemas ──────────────────────────────────────────────────
class UserIn(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"

class CategoryCreate(BaseModel):
    name: str

class CategoryResponse(BaseModel):
    id:   int
    name: str

class TagResponse(BaseModel):
    id:   int
    name: str

class MemoCreate(BaseModel):
    title:       str
    content:     str
    category_id: Optional[int] = None
    tags:        List[str]     = []

class MemoUpdate(BaseModel):
    title:       Optional[str]       = None
    content:     Optional[str]       = None
    category_id: Optional[int]       = None
    tags:        Optional[List[str]] = None

class MemoResponse(BaseModel):
    id:          int
    title:       str
    content:     str
    category_id: Optional[int]
    tags:        List[str]
    created_at:  datetime
    updated_at:  datetime


# ── JWT helpers ───────────────────────────────────────────────────────
def create_token(user_id: int) -> str:
    expire  = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> int:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── DB helpers ────────────────────────────────────────────────────────
def _get_memo_tags(conn: sqlite3.Connection, memo_id: int) -> List[str]:
    return [r[0] for r in conn.execute(
        "SELECT t.name FROM tags t JOIN memo_tags mt ON t.id = mt.tag_id WHERE mt.memo_id = ? ORDER BY t.name",
        (memo_id,),
    ).fetchall()]


def _set_memo_tags(conn: sqlite3.Connection, memo_id: int, tag_names: List[str], user_id: int) -> None:
    conn.execute("DELETE FROM memo_tags WHERE memo_id = ?", (memo_id,))
    for raw in tag_names:
        name = raw.strip()
        if not name:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO tags (user_id, name, created_at) VALUES (?, ?, ?)",
            (user_id, name, datetime.now().isoformat()),
        )
        tag_id = conn.execute(
            "SELECT id FROM tags WHERE user_id = ? AND name = ?", (user_id, name)
        ).fetchone()[0]
        conn.execute(
            "INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)",
            (memo_id, tag_id),
        )


def _row_to_memo(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = _get_memo_tags(conn, d["id"])
    return d


# ── App ───────────────────────────────────────────────────────────────
init_db()

app = FastAPI(
    title="메모장 API",
    description="FastAPI + SQLite + JWT 인증 메모 CRUD API",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/static/index.html")


# ── Auth ──────────────────────────────────────────────────────────────
@app.post("/auth/register", status_code=201, summary="회원가입")
def register(data: UserIn, conn: sqlite3.Connection = Depends(get_conn)):
    if not data.username.strip() or not data.password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력하세요.")
    if conn.execute("SELECT 1 FROM users WHERE username = ?", (data.username,)).fetchone():
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디입니다.")
    conn.execute(
        "INSERT INTO users (username, hashed_password, created_at) VALUES (?, ?, ?)",
        (data.username, hash_pw(data.password), datetime.now().isoformat()),
    )
    conn.commit()
    return {"message": "회원가입이 완료됐습니다."}


@app.post("/auth/login", response_model=TokenResponse, summary="로그인")
def login(data: UserIn, conn: sqlite3.Connection = Depends(get_conn)):
    user = conn.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
    if not user or not verify_pw(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    return {"access_token": create_token(user["id"])}


# ── Categories ────────────────────────────────────────────────────────
@app.get("/categories", response_model=List[CategoryResponse], summary="카테고리 목록")
def list_categories(
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    return [dict(r) for r in conn.execute(
        "SELECT id, name FROM categories WHERE user_id = ? ORDER BY name", (uid,)
    ).fetchall()]


@app.post("/categories", response_model=CategoryResponse, status_code=201, summary="카테고리 생성")
def create_category(
    data: CategoryCreate,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="카테고리 이름을 입력하세요.")
    if conn.execute("SELECT 1 FROM categories WHERE user_id = ? AND name = ?", (uid, name)).fetchone():
        raise HTTPException(status_code=409, detail="이미 존재하는 카테고리입니다.")
    cur = conn.execute(
        "INSERT INTO categories (user_id, name, created_at) VALUES (?, ?, ?)",
        (uid, name, datetime.now().isoformat()),
    )
    conn.commit()
    return {"id": cur.lastrowid, "name": name}


@app.delete("/categories/{category_id}", status_code=204, summary="카테고리 삭제")
def delete_category(
    category_id: int,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    if not conn.execute("SELECT 1 FROM categories WHERE id = ? AND user_id = ?", (category_id, uid)).fetchone():
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    conn.execute("UPDATE memos SET category_id = NULL WHERE category_id = ? AND user_id = ?", (category_id, uid))
    conn.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", (category_id, uid))
    conn.commit()


# ── Tags ──────────────────────────────────────────────────────────────
@app.get("/tags", response_model=List[TagResponse], summary="태그 목록")
def list_tags(
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    return [dict(r) for r in conn.execute(
        "SELECT id, name FROM tags WHERE user_id = ? ORDER BY name", (uid,)
    ).fetchall()]


# ── Memos ─────────────────────────────────────────────────────────────
def _get_memo_or_404(conn: sqlite3.Connection, memo_id: int, user_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return row


@app.get("/memos", response_model=List[MemoResponse], summary="메모 목록 조회")
def list_memos(
    category_id: Optional[int] = None,
    tag:         Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    sql    = "SELECT DISTINCT m.* FROM memos m"
    params: list = [uid]

    if tag:
        sql += " JOIN memo_tags mt ON m.id = mt.memo_id JOIN tags t ON mt.tag_id = t.id AND t.name = ?"
        params.insert(0, tag)
        sql += " WHERE m.user_id = ?"
    else:
        sql += " WHERE m.user_id = ?"

    if category_id is not None:
        sql += " AND m.category_id = ?"
        params.append(category_id)

    sql += " ORDER BY m.id DESC"
    rows = conn.execute(sql, params).fetchall()
    return [_row_to_memo(conn, r) for r in rows]


@app.get("/memos/{memo_id}", response_model=MemoResponse, summary="메모 단건 조회")
def get_memo(
    memo_id: int,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    return _row_to_memo(conn, _get_memo_or_404(conn, memo_id, uid))


@app.post("/memos", response_model=MemoResponse, status_code=201, summary="메모 생성")
def create_memo(
    data: MemoCreate,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    now = datetime.now().isoformat()
    cur = conn.execute(
        "INSERT INTO memos (user_id, category_id, title, content, created_at, updated_at) VALUES (?,?,?,?,?,?)",
        (uid, data.category_id, data.title, data.content, now, now),
    )
    memo_id = cur.lastrowid
    if data.tags:
        _set_memo_tags(conn, memo_id, data.tags, uid)
    conn.commit()
    return _row_to_memo(conn, conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone())


@app.put("/memos/{memo_id}", response_model=MemoResponse, summary="메모 수정")
def update_memo(
    memo_id: int,
    data: MemoUpdate,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    _get_memo_or_404(conn, memo_id, uid)
    payload = data.model_dump(exclude_unset=True)
    tags    = payload.pop("tags", None)

    payload["updated_at"] = datetime.now().isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in payload)
    conn.execute(
        f"UPDATE memos SET {set_clause} WHERE id = ? AND user_id = ?",
        (*payload.values(), memo_id, uid),
    )
    if tags is not None:
        _set_memo_tags(conn, memo_id, tags, uid)
    conn.commit()
    return _row_to_memo(conn, conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone())


@app.delete("/memos/{memo_id}", status_code=204, summary="메모 삭제")
def delete_memo(
    memo_id: int,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    _get_memo_or_404(conn, memo_id, uid)
    conn.execute("DELETE FROM memos WHERE id = ? AND user_id = ?", (memo_id, uid))
    conn.commit()


app.mount("/static", StaticFiles(directory="static"), name="static")
