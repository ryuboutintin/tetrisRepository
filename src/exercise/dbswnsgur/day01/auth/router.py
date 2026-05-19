import sqlite3
from contextlib import contextmanager
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pydantic import BaseModel

from .jwt_utils import create_access_token, get_current_user

# memo/main.py에서 오버라이드 가능
DB_PATH = "memo.db"

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_users_table():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT    NOT NULL UNIQUE,
                password TEXT    NOT NULL
            )
        """)


class RegisterRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


@router.post("/register", status_code=201)
def register(body: RegisterRequest):
    if len(body.username) < 3:
        raise HTTPException(status_code=400, detail="아이디는 3자 이상이어야 합니다")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 합니다")

    hashed = pwd_context.hash(body.password)
    with get_db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                (body.username, hashed),
            )
            user_id = cur.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="이미 사용 중인 아이디입니다")

    token = create_access_token(user_id=user_id, username=body.username)
    return {"access_token": token, "token_type": "bearer", "username": body.username}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends()):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (form.username,)
        ).fetchone()

    if row is None or not pwd_context.verify(form.password, row["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user_id=row["id"], username=row["username"])
    return {"access_token": token, "token_type": "bearer", "username": row["username"]}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user
