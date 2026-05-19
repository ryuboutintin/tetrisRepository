"""
JWT 인증 API
- POST /auth/register  : 회원가입
- POST /auth/login     : 로그인 (access + refresh token 발급)
- POST /auth/refresh   : access token 갱신
- POST /auth/logout    : 로그아웃 (refresh token 무효화)
- GET  /me             : 내 정보 조회 (보호 엔드포인트)
- GET  /me/items       : 내 아이템 목록 (보호 엔드포인트)
"""

import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

# ── 설정 ──────────────────────────────────────────────────────────────────────
SECRET_KEY = "change-me-in-production-use-env-var"
REFRESH_SECRET_KEY = "refresh-secret-change-me-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15       # 짧게 유지
REFRESH_TOKEN_EXPIRE_DAYS = 7

DB_PATH = "auth.db"

# ── 암호화 / OAuth2 ────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── DB ────────────────────────────────────────────────────────────────────────
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                username      TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                token      TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                revoked    INTEGER NOT NULL DEFAULT 0
            );
        """)


# ── 모델 ──────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── JWT 헬퍼 ──────────────────────────────────────────────────────────────────
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": _now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": _now(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> tuple[str, datetime]:
    """refresh token 문자열과 만료 시각을 함께 반환"""
    expires_at = _now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": expires_at,
        "iat": _now(),
        "jti": str(uuid.uuid4()),   # 고유 ID — 재사용 방지
    }
    token = jwt.encode(payload, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return token, expires_at


def _decode_access(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않거나 만료된 access token")
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "access token이 아닙니다")
    return payload


def _decode_refresh(token: str) -> dict:
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "유효하지 않거나 만료된 refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "refresh token이 아닙니다")
    return payload


# ── 인증 의존성 ────────────────────────────────────────────────────────────────
def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = _decode_access(token)
    user_id = payload["sub"]
    with get_db() as conn:
        row = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용자를 찾을 수 없습니다")
    return {"id": row["id"], "username": row["username"]}


# ── 앱 ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="JWT Auth Demo")


@app.on_event("startup")
def startup():
    init_db()


# ── 인증 라우터 ────────────────────────────────────────────────────────────────
@app.post("/auth/register", status_code=status.HTTP_201_CREATED, response_model=TokenPair)
def register(body: RegisterRequest):
    if len(body.username) < 2 or len(body.password) < 6:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "username 2자 이상, password 6자 이상 필요")
    password_hash = pwd_context.hash(body.password)
    user_id = str(uuid.uuid4())
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)",
                (user_id, body.username, password_hash, _now().isoformat()),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 존재하는 username입니다")

    access = create_access_token(user_id)
    refresh, expires_at = create_refresh_token(user_id)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?,?,?)",
            (refresh, user_id, expires_at.isoformat()),
        )
    return TokenPair(access_token=access, refresh_token=refresh)


@app.post("/auth/login", response_model=TokenPair)
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (form.username,)
        ).fetchone()
    if row is None or not pwd_context.verify(form.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다")

    user_id = row["id"]
    access = create_access_token(user_id)
    refresh, expires_at = create_refresh_token(user_id)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?,?,?)",
            (refresh, user_id, expires_at.isoformat()),
        )
    return TokenPair(access_token=access, refresh_token=refresh)


@app.post("/auth/refresh", response_model=TokenPair)
def refresh_token(body: RefreshRequest):
    """refresh token으로 새 access token 발급 (refresh token은 재사용 불가 — rotate)"""
    payload = _decode_refresh(body.refresh_token)
    user_id = payload["sub"]

    with get_db() as conn:
        row = conn.execute(
            "SELECT revoked, expires_at FROM refresh_tokens WHERE token = ?",
            (body.refresh_token,),
        ).fetchone()
        if row is None or row["revoked"]:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용할 수 없는 refresh token입니다")

        # 만료 재확인 (DB 기준)
        if datetime.fromisoformat(row["expires_at"]) < _now():
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "refresh token이 만료되었습니다")

        # 기존 token revoke (rotate)
        conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", (body.refresh_token,))

        # 새 refresh token 발급
        new_refresh, new_expires = create_refresh_token(user_id)
        conn.execute(
            "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?,?,?)",
            (new_refresh, user_id, new_expires.isoformat()),
        )

    new_access = create_access_token(user_id)
    # 편의상 응답에 새 refresh token도 포함 (클라이언트가 교체해야 함)
    return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest):
    """refresh token을 무효화(revoke)하여 로그아웃"""
    with get_db() as conn:
        conn.execute(
            "UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", (body.refresh_token,)
        )


# ── 보호 엔드포인트 ────────────────────────────────────────────────────────────
@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "message": "인증된 사용자만 볼 수 있는 정보입니다",
    }


@app.get("/me/items")
def get_my_items(current_user: dict = Depends(get_current_user)):
    # 실제 서비스라면 DB에서 조회; 여기선 예시 데이터
    return {
        "username": current_user["username"],
        "items": [
            {"id": 1, "name": "아이템 A"},
            {"id": 2, "name": "아이템 B"},
        ],
    }
