import os
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base
from jose import JWTError, jwt
from passlib.context import CryptContext

# ── 스키마 변경 시 DB 자동 재생성 ────────────────────────────────────
def _needs_migration() -> bool:
    if not os.path.exists("./memo.db"):
        return False
    try:
        with sqlite3.connect("./memo.db") as conn:
            conn.execute("SELECT user_id FROM memos LIMIT 1")
        return False
    except sqlite3.OperationalError:
        return True

if _needs_migration():
    os.remove("./memo.db")

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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


Base.metadata.create_all(bind=engine)

# ── JWT / 인증 ───────────────────────────────────────────────────────
SECRET_KEY = "memo-app-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24시간

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


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
    token_type: str


class MemoCreate(BaseModel):
    title: str
    content: str = ""


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
        user = UserModel(username=body.username, hashed_password=hash_password(body.password))
        db.add(user)
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
        return {"access_token": create_access_token(user.username), "token_type": "bearer"}
    finally:
        db.close()


# ── 정적 파일 ────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return FileResponse("index.html")


# ── 메모 라우트 (인증 필요) ──────────────────────────────────────────
@app.get("/memos", response_model=list[MemoResponse])
def list_memos(current_user: UserModel = Depends(get_current_user)):
    db = SessionLocal()
    try:
        return (
            db.query(MemoModel)
            .filter(MemoModel.user_id == current_user.id)
            .order_by(MemoModel.updated_at.desc())
            .all()
        )
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
        memo = MemoModel(title=body.title, content=body.content, user_id=current_user.id)
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
        memo.updated_at = datetime.now(timezone.utc)
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
