import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

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
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                title      TEXT    NOT NULL,
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL,
                updated_at TEXT    NOT NULL
            )
        """)
        # 기존 memos 테이블에 user_id 컬럼이 없으면 추가
        cols = [r[1] for r in conn.execute("PRAGMA table_info(memos)").fetchall()]
        if "user_id" not in cols:
            conn.execute("ALTER TABLE memos ADD COLUMN user_id INTEGER")
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

class MemoCreate(BaseModel):
    title:   str
    content: str

class MemoUpdate(BaseModel):
    title:   Optional[str] = None
    content: Optional[str] = None

class MemoResponse(BaseModel):
    id:         int
    title:      str
    content:    str
    created_at: datetime
    updated_at: datetime


# ── JWT helpers ───────────────────────────────────────────────────────
def create_token(user_id: int) -> str:
    expire  = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> int:
    """JWT 토큰을 검증하고 user_id를 반환한다."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── App ───────────────────────────────────────────────────────────────
init_db()

app = FastAPI(
    title="메모장 API",
    description="FastAPI + SQLite + JWT 인증 메모 CRUD API",
    version="3.0.0",
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


# ── Memos (인증 필요) ─────────────────────────────────────────────────
def _get_memo_or_404(conn: sqlite3.Connection, memo_id: int, user_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM memos WHERE id = ? AND user_id = ?", (memo_id, user_id)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return row


@app.get("/memos", response_model=list[MemoResponse], summary="메모 목록 조회")
def list_memos(
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    return [dict(r) for r in conn.execute(
        "SELECT * FROM memos WHERE user_id = ? ORDER BY id DESC", (uid,)
    ).fetchall()]


@app.get("/memos/{memo_id}", response_model=MemoResponse, summary="메모 단건 조회")
def get_memo(
    memo_id: int,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    return dict(_get_memo_or_404(conn, memo_id, uid))


@app.post("/memos", response_model=MemoResponse, status_code=201, summary="메모 생성")
def create_memo(
    data: MemoCreate,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    now = datetime.now().isoformat()
    cur = conn.execute(
        "INSERT INTO memos (user_id, title, content, created_at, updated_at) VALUES (?,?,?,?,?)",
        (uid, data.title, data.content, now, now),
    )
    conn.commit()
    return dict(conn.execute("SELECT * FROM memos WHERE id = ?", (cur.lastrowid,)).fetchone())


@app.put("/memos/{memo_id}", response_model=MemoResponse, summary="메모 수정")
def update_memo(
    memo_id: int,
    data: MemoUpdate,
    conn: sqlite3.Connection = Depends(get_conn),
    uid: int = Depends(get_current_user_id),
):
    _get_memo_or_404(conn, memo_id, uid)
    fields = data.model_dump(exclude_unset=True)
    fields["updated_at"] = datetime.now().isoformat()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(
        f"UPDATE memos SET {set_clause} WHERE id = ? AND user_id = ?",
        (*fields.values(), memo_id, uid),
    )
    conn.commit()
    return dict(conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone())


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
