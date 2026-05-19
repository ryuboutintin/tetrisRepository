import json
import os
import secrets
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, field_validator
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base
from jose import JWTError, jwt
from passlib.context import CryptContext

# ── DB 마이그레이션 ───────────────────────────────────────────────────
def _migrate_db() -> None:
    if not os.path.exists("./memo.db"):
        return
    needs_recreate = False
    with sqlite3.connect("./memo.db") as conn:
        try:
            conn.execute("SELECT user_id FROM memos LIMIT 1")
        except sqlite3.OperationalError:
            needs_recreate = True
        if not needs_recreate:
            try:
                conn.execute("SELECT color FROM memos LIMIT 1")
            except sqlite3.OperationalError:
                conn.execute("ALTER TABLE memos ADD COLUMN color VARCHAR DEFAULT 'yellow'")
                conn.commit()
            try:
                conn.execute("SELECT tags FROM memos LIMIT 1")
            except sqlite3.OperationalError:
                conn.execute("ALTER TABLE memos ADD COLUMN tags VARCHAR DEFAULT '[]'")
                conn.commit()
    if needs_recreate:
        os.remove("./memo.db")

_migrate_db()

# ── DB ───────────────────────────────────────────────────────────────
DATABASE_URL = "sqlite:///./memo.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)


class MemoModel(Base):
    __tablename__ = "memos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False, default="")
    color = Column(String, nullable=False, default="yellow")
    tags = Column(String, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class RefreshTokenModel(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)


Base.metadata.create_all(bind=engine)

# ── JWT / 인증 ───────────────────────────────────────────────────────
SECRET_KEY = "memo-app-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _issue_refresh_token(user_id: int, db) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshTokenModel(token=token, user_id=user_id, expires_at=expires))
    db.commit()
    return token


def get_current_user(token: str = Depends(oauth2_scheme)):
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise exc
    except JWTError:
        raise exc

    db = SessionLocal()
    try:
        user = db.query(UserModel).filter(UserModel.username == username).first()
        if not user:
            raise exc
        return user
    finally:
        db.close()


# ── Schemas ──────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class MemoCreate(BaseModel):
    title: str
    content: str = ""
    color: str = "yellow"
    tags: list[str] = []


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    tags: Optional[list[str]] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    color: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []


# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(title="Memo API")

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 인증 라우트 ──────────────────────────────────────────────────────
@app.post("/auth/register", status_code=201)
def register(body: UserCreate):
    db = SessionLocal()
    try:
        if db.query(UserModel).filter(UserModel.username == body.username).first():
            raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
        db.add(UserModel(username=body.username, hashed_password=hash_password(body.password)))
        db.commit()
        return {"message": "회원가입 성공"}
    finally:
        db.close()


@app.post("/auth/token", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    try:
        user = db.query(UserModel).filter(UserModel.username == form.username).first()
        if not user or not verify_password(form.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="아이디 또는 비밀번호가 올바르지 않습니다.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {
            "access_token": create_access_token(user.username),
            "refresh_token": _issue_refresh_token(user.id, db),
            "token_type": "bearer",
        }
    finally:
        db.close()


@app.post("/auth/refresh", response_model=Token)
def refresh_tokens(body: RefreshRequest):
    db = SessionLocal()
    try:
        rt = db.query(RefreshTokenModel).filter(RefreshTokenModel.token == body.refresh_token).first()
        if not rt or rt.expires_at < datetime.utcnow():
            if rt:
                db.delete(rt)
                db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token이 만료되었거나 유효하지 않습니다.",
            )
        user = db.query(UserModel).filter(UserModel.id == rt.user_id).first()
        if not user:
            db.delete(rt)
            db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")

        # 토큰 로테이션: 기존 삭제 후 새로 발급
        db.delete(rt)
        db.commit()
        return {
            "access_token": create_access_token(user.username),
            "refresh_token": _issue_refresh_token(user.id, db),
            "token_type": "bearer",
        }
    finally:
        db.close()


@app.post("/auth/logout")
def logout_route(body: LogoutRequest):
    db = SessionLocal()
    try:
        rt = db.query(RefreshTokenModel).filter(RefreshTokenModel.token == body.refresh_token).first()
        if rt:
            db.delete(rt)
            db.commit()
        return {"message": "로그아웃 완료"}
    finally:
        db.close()


# ── 정적 파일 ────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return FileResponse("index.html")


# ── 메모 라우트 (인증 필요) ──────────────────────────────────────────
@app.get("/memos", response_model=list[MemoResponse])
def list_memos(tag: Optional[str] = None, current_user: UserModel = Depends(get_current_user)):
    db = SessionLocal()
    try:
        query = db.query(MemoModel).filter(MemoModel.user_id == current_user.id)
        if tag:
            query = query.filter(MemoModel.tags.like(f'%"{tag}"%'))
        return query.order_by(MemoModel.updated_at.desc()).all()
    finally:
        db.close()


@app.get("/memos/{memo_id}", response_model=MemoResponse)
def get_memo(memo_id: int, current_user: UserModel = Depends(get_current_user)):
    db = SessionLocal()
    try:
        memo = (
            db.query(MemoModel)
            .filter(MemoModel.id == memo_id, MemoModel.user_id == current_user.id)
            .first()
        )
        if not memo:
            raise HTTPException(status_code=404, detail="Memo not found")
        return memo
    finally:
        db.close()


@app.post("/memos", response_model=MemoResponse, status_code=201)
def create_memo(body: MemoCreate, current_user: UserModel = Depends(get_current_user)):
    db = SessionLocal()
    try:
        memo = MemoModel(
            title=body.title,
            content=body.content,
            color=body.color,
            tags=json.dumps(body.tags, ensure_ascii=False),
            user_id=current_user.id,
        )
        db.add(memo)
        db.commit()
        db.refresh(memo)
        return memo
    finally:
        db.close()


@app.put("/memos/{memo_id}", response_model=MemoResponse)
def update_memo(memo_id: int, body: MemoUpdate, current_user: UserModel = Depends(get_current_user)):
    db = SessionLocal()
    try:
        memo = (
            db.query(MemoModel)
            .filter(MemoModel.id == memo_id, MemoModel.user_id == current_user.id)
            .first()
        )
        if not memo:
            raise HTTPException(status_code=404, detail="Memo not found")
        if body.title is not None:
            memo.title = body.title
        if body.content is not None:
            memo.content = body.content
        if body.color is not None:
            memo.color = body.color
        if body.tags is not None:
            memo.tags = json.dumps(body.tags, ensure_ascii=False)
        memo.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(memo)
        return memo
    finally:
        db.close()


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, current_user: UserModel = Depends(get_current_user)):
    db = SessionLocal()
    try:
        memo = (
            db.query(MemoModel)
            .filter(MemoModel.id == memo_id, MemoModel.user_id == current_user.id)
            .first()
        )
        if not memo:
            raise HTTPException(status_code=404, detail="Memo not found")
        db.delete(memo)
        db.commit()
    finally:
        db.close()
