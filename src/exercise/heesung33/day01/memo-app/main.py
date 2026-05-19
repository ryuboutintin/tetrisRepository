from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import engine, get_db, Base
from models import User, Tag
from schemas import MemoCreate, MemoUpdate, MemoRead, UserCreate, UserRead, Token, TagRead
from auth import hash_password, verify_password, create_access_token, get_current_user
import crud

# 앱 실행 시 테이블 자동 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Memo App")

# CORS 허용 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 및 템플릿 설정
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# --- 페이지 ---
@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# --- 인증 API ---
@app.post("/auth/register", response_model=UserRead, status_code=201)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 사용자명입니다")
    db_user = User(username=user.username, hashed_password=hash_password(user.password))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="사용자명 또는 비밀번호가 올바르지 않습니다")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# --- 메모 CRUD API (인증 필수) ---
@app.post("/memos", response_model=MemoRead, status_code=201)
def create_memo(
    memo: MemoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.create_memo(db, memo, current_user)


@app.get("/memos", response_model=list[MemoRead])
def read_memos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.get_memos(db, current_user)


@app.get("/memos/{memo_id}", response_model=MemoRead)
def read_memo(
    memo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_memo = crud.get_memo(db, memo_id, current_user)
    if db_memo is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return db_memo


@app.put("/memos/{memo_id}", response_model=MemoRead)
def update_memo(
    memo_id: int,
    memo: MemoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_memo = crud.update_memo(db, memo_id, memo, current_user)
    if db_memo is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return db_memo


@app.delete("/memos/{memo_id}")
def delete_memo(
    memo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = crud.delete_memo(db, memo_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return {"message": "메모가 삭제되었습니다"}


# --- 태그 API ---
@app.get("/tags", response_model=list[TagRead])
def read_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Tag).order_by(Tag.name).all()
