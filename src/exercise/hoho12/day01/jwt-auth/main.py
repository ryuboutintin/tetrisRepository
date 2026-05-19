"""
JWT 인증 API (FastAPI + SQLite)

엔드포인트:
  POST /auth/register  — 회원가입 (access + refresh token 발급)
  POST /auth/login     — 로그인   (access + refresh token 발급)
  POST /auth/refresh   — access token 갱신 (refresh token rotate)
  POST /auth/logout    — 로그아웃 (refresh token revoke)
  GET  /me             — 내 프로필 [보호]
  GET  /protected      — 인증 필요 리소스 [보호]

토큰 전략:
  - access token  : 15분 만료 / HS256 / Authorization 헤더로 전달
  - refresh token : 7일 만료 / 별도 시크릿 / DB에 저장·revoke 관리
  - refresh 시 기존 refresh token을 즉시 revoke하고 새 토큰 발급 (rotate)
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
ACCESS_SECRET  = "access-secret-change-me"   # 실 서비스에서는 환경변수로 주입
REFRESH_SECRET = "refresh-secret-change-me"
ALGORITHM      = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES  = 15
REFRESH_TOKEN_EXPIRE_DAYS    = 7

DB_PATH = "auth.db"

# ── 인프라 ────────────────────────────────────────────────────────────────────
pwd_context  = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


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
                jti        TEXT PRIMARY KEY,       -- JWT ID (고유 식별자)
                user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                revoked    INTEGER NOT NULL DEFAULT 0
            );
        """)


# ── Pydantic 모델 ──────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class AccessToken(BaseModel):
    access_token: str
    token_type:   str = "bearer"


# ── JWT 헬퍼 ──────────────────────────────────────────────────────────────────
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _make_access_token(user_id: str) -> str:
    payload = {
        "sub":  user_id,
        "type": "access",
        "iat":  _now(),
        "exp":  _now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, ACCESS_SECRET, algorithm=ALGORITHM)


def _make_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """(token_str, jti, expires_at) 반환"""
    jti = str(uuid.uuid4())
    expires_at = _now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub":  user_id,
        "type": "refresh",
        "jti":  jti,
        "iat":  _now(),
        "exp":  expires_at,
    }
    token = jwt.encode(payload, REFRESH_SECRET, algorithm=ALGORITHM)
    return token, jti, expires_at


def _decode_access(token: str) -> dict:
    try:
        payload = jwt.decode(token, ACCESS_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "만료되었거나 유효하지 않은 access token")
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "access token이 아닙니다")
    return payload


def _decode_refresh(token: str) -> dict:
    try:
        payload = jwt.decode(token, REFRESH_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "만료되었거나 유효하지 않은 refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "refresh token이 아닙니다")
    return payload


# ── 인증 의존성 ────────────────────────────────────────────────────────────────
def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = _decode_access(token)
    user_id = payload["sub"]
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, username FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "사용자를 찾을 수 없습니다")
    return {"id": row["id"], "username": row["username"]}


# ── 앱 ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="JWT Auth API")


@app.on_event("startup")
def startup():
    init_db()


# ── 인증 엔드포인트 ────────────────────────────────────────────────────────────
@app.post("/auth/register", response_model=TokenPair, status_code=201)
def register(body: RegisterRequest):
    if len(body.username) < 2:
        raise HTTPException(422, "username은 2자 이상이어야 합니다")
    if len(body.password) < 6:
        raise HTTPException(422, "password는 6자 이상이어야 합니다")

    user_id = str(uuid.uuid4())
    password_hash = pwd_context.hash(body.password)

    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)",
                (user_id, body.username, password_hash, _now().isoformat()),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "이미 사용 중인 username입니다")

    access = _make_access_token(user_id)
    refresh, jti, expires_at = _make_refresh_token(user_id)

    with get_db() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES (?,?,?)",
            (jti, user_id, expires_at.isoformat()),
        )

    return TokenPair(access_token=access, refresh_token=refresh)


@app.post("/auth/login", response_model=TokenPair)
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (form.username,)
        ).fetchone()

    if row is None or not pwd_context.verify(form.password, row["password_hash"]):
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다")

    user_id = row["id"]
    access = _make_access_token(user_id)
    refresh, jti, expires_at = _make_refresh_token(user_id)

    with get_db() as conn:
        conn.execute(
            "INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES (?,?,?)",
            (jti, user_id, expires_at.isoformat()),
        )

    return TokenPair(access_token=access, refresh_token=refresh)


@app.post("/auth/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest):
    """
    refresh token으로 새 access + refresh token 발급.
    기존 refresh token은 즉시 revoke (token rotation).
    탈취된 토큰의 재사용을 방지합니다.
    """
    payload = _decode_refresh(body.refresh_token)
    jti     = payload["jti"]
    user_id = payload["sub"]

    with get_db() as conn:
        row = conn.execute(
            "SELECT revoked, expires_at FROM refresh_tokens WHERE jti = ?", (jti,)
        ).fetchone()

        if row is None:
            raise HTTPException(401, "등록되지 않은 refresh token입니다")
        if row["revoked"]:
            # 이미 사용된 토큰 재사용 시도 → 해당 유저의 모든 토큰 revoke (탈취 가능성)
            conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?", (user_id,))
            raise HTTPException(401, "이미 사용된 refresh token입니다. 보안상 모든 세션이 종료되었습니다")
        if datetime.fromisoformat(row["expires_at"]) < _now():
            raise HTTPException(401, "refresh token이 만료되었습니다. 다시 로그인해주세요")

        # 기존 token revoke 후 새 token 발급
        conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?", (jti,))

        new_refresh, new_jti, new_expires = _make_refresh_token(user_id)
        conn.execute(
            "INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES (?,?,?)",
            (new_jti, user_id, new_expires.isoformat()),
        )

    new_access = _make_access_token(user_id)
    return TokenPair(access_token=new_access, refresh_token=new_refresh)


@app.post("/auth/logout", status_code=204)
def logout(body: RefreshRequest):
    """refresh token을 revoke하여 로그아웃. access token은 만료될 때까지 유효합니다."""
    payload = _decode_refresh(body.refresh_token)
    jti = payload["jti"]
    with get_db() as conn:
        conn.execute("UPDATE refresh_tokens SET revoked = 1 WHERE jti = ?", (jti,))


# ── 보호 엔드포인트 ────────────────────────────────────────────────────────────
@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id":       current_user["id"],
        "username": current_user["username"],
    }


@app.get("/protected")
def protected_resource(current_user: dict = Depends(get_current_user)):
    return {
        "message": f"안녕하세요, {current_user['username']}님! 인증된 사용자만 접근할 수 있는 리소스입니다.",
        "user_id": current_user["id"],
    }
