from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional

import models
import schemas
from database import engine, get_db
from auth import verify_password, get_password_hash, create_access_token, get_current_user

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="메모장 API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ──────────────────────────────────────────────────────────────────────

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
    return {"access_token": create_access_token({"sub": user.username}), "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserResponse)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Tags ──────────────────────────────────────────────────────────────────────

@app.get("/tags", response_model=List[schemas.TagResponse])
def get_tags(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Tag).filter(models.Tag.user_id == current_user.id).all()


@app.post("/tags", response_model=schemas.TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(tag: schemas.TagCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if db.query(models.Tag).filter(models.Tag.user_id == current_user.id, models.Tag.name == tag.name.strip()).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 태그입니다")
    db_tag = models.Tag(name=tag.name.strip(), color=tag.color or "#ff69b4", user_id=current_user.id)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


@app.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tag(tag_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    tag = db.query(models.Tag).filter(models.Tag.id == tag_id, models.Tag.user_id == current_user.id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="태그를 찾을 수 없습니다")
    db.delete(tag)
    db.commit()


# ── Memos ─────────────────────────────────────────────────────────────────────

@app.get("/memos", response_model=List[schemas.MemoResponse])
def get_memos(
    tag_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Memo).filter(models.Memo.user_id == current_user.id)
    if tag_id:
        q = q.filter(models.Memo.tags.any(models.Tag.id == tag_id))
    return q.order_by(models.Memo.created_at.desc()).all()


@app.post("/memos", response_model=schemas.MemoResponse, status_code=status.HTTP_201_CREATED)
def create_memo(memo: schemas.MemoCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_memo = models.Memo(title=memo.title, content=memo.content, user_id=current_user.id)
    if memo.tag_ids:
        db_memo.tags = db.query(models.Tag).filter(
            models.Tag.id.in_(memo.tag_ids), models.Tag.user_id == current_user.id
        ).all()
    db.add(db_memo)
    db.commit()
    db.refresh(db_memo)
    return db_memo


@app.get("/memos/{memo_id}", response_model=schemas.MemoResponse)
def get_memo(memo_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memo = db.query(models.Memo).filter(models.Memo.id == memo_id, models.Memo.user_id == current_user.id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return memo


@app.put("/memos/{memo_id}", response_model=schemas.MemoResponse)
def update_memo(memo_id: int, memo_update: schemas.MemoUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memo = db.query(models.Memo).filter(models.Memo.id == memo_id, models.Memo.user_id == current_user.id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    if memo_update.title is not None:
        memo.title = memo_update.title
    if memo_update.content is not None:
        memo.content = memo_update.content
    if memo_update.tag_ids is not None:
        memo.tags = db.query(models.Tag).filter(
            models.Tag.id.in_(memo_update.tag_ids), models.Tag.user_id == current_user.id
        ).all()
    db.commit()
    db.refresh(memo)
    return memo


@app.delete("/memos/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memo(memo_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    memo = db.query(models.Memo).filter(models.Memo.id == memo_id, models.Memo.user_id == current_user.id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    db.delete(memo)
    db.commit()
