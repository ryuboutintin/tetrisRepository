from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional

import models
import schemas
from database import engine, get_db
from auth import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    rotate_refresh_token, revoke_refresh_token,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="찻집 메모장 API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def index():
    resp = FileResponse("index.html", media_type="text/html")
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    return resp


# ── Auth ──────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if len(user.username.strip()) < 2:
        raise HTTPException(status_code=400, detail="아이디는 2자 이상이어야 합니다")
    if len(user.password) < 4:
        raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다")
    if db.query(models.User).filter(models.User.username == user.username).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다")
    db_user = models.User(
        username=user.username.strip(),
        hashed_password=get_password_hash(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/auth/token", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "access_token": create_access_token({"sub": user.username}),
        "refresh_token": create_refresh_token(user.id, db),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@app.post("/auth/refresh", response_model=schemas.Token)
def refresh(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    user, new_refresh = rotate_refresh_token(body.refresh_token, db)
    return {
        "access_token": create_access_token({"sub": user.username}),
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: schemas.LogoutRequest, db: Session = Depends(get_db)):
    revoke_refresh_token(body.refresh_token, db)


@app.get("/auth/me", response_model=schemas.UserResponse)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Categories ────────────────────────────────────────────────────────

@app.get("/categories", response_model=List[str])
def get_categories():
    """찻집 카테고리 목록을 반환합니다 (서버 상수)."""
    return schemas.CATEGORIES


# ── Memos ─────────────────────────────────────────────────────────────

@app.get("/memos", response_model=List[schemas.MemoResponse])
def get_memos(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Memo).filter(models.Memo.user_id == current_user.id)
    if category:
        q = q.filter(models.Memo.category == category)
    if tag:
        q = q.filter(models.Memo.tags.any(models.MemoTag.name == tag))
    return q.order_by(models.Memo.created_at.desc()).all()


@app.post("/memos", response_model=schemas.MemoResponse, status_code=status.HTTP_201_CREATED)
def create_memo(
    memo: schemas.MemoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_memo = models.Memo(
        title=memo.title,
        content=memo.content,
        category=memo.category or None,
        user_id=current_user.id,
    )
    db_memo.tags = [models.MemoTag(name=t.strip()) for t in memo.tags if t.strip()]
    db.add(db_memo)
    db.commit()
    db.refresh(db_memo)
    return db_memo


@app.get("/memos/{memo_id}", response_model=schemas.MemoResponse)
def get_memo(
    memo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memo = db.query(models.Memo).filter(
        models.Memo.id == memo_id, models.Memo.user_id == current_user.id
    ).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return memo


@app.put("/memos/{memo_id}", response_model=schemas.MemoResponse)
def update_memo(
    memo_id: int,
    memo_update: schemas.MemoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memo = db.query(models.Memo).filter(
        models.Memo.id == memo_id, models.Memo.user_id == current_user.id
    ).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    if memo_update.title is not None:
        memo.title = memo_update.title
    if memo_update.content is not None:
        memo.content = memo_update.content
    if memo_update.category is not None:
        memo.category = memo_update.category or None
    if memo_update.tags is not None:
        for old in memo.tags:
            db.delete(old)
        memo.tags = [models.MemoTag(name=t.strip()) for t in memo_update.tags if t.strip()]
    db.commit()
    db.refresh(memo)
    return memo


@app.delete("/memos/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memo(
    memo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    memo = db.query(models.Memo).filter(
        models.Memo.id == memo_id, models.Memo.user_id == current_user.id
    ).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    db.delete(memo)
    db.commit()
