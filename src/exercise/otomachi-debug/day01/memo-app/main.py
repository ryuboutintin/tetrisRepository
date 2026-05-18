from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import auth, models, schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Memo API")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")


# ── Auth helpers ───────────────────────────────────

def get_current_user(username: str = Depends(auth.decode_token), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Auth routes ────────────────────────────────────

@app.post("/auth/register", response_model=schemas.Token, status_code=201)
def register(body: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = models.User(username=body.username, hashed_password=auth.hash_password(body.password))
    db.add(user)
    db.commit()
    return {"access_token": auth.create_access_token(user.username)}


@app.post("/auth/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not auth.verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": auth.create_access_token(user.username)}


@app.get("/auth/me")
def me(user: models.User = Depends(get_current_user)):
    return {"username": user.username}


# ── Tag routes ─────────────────────────────────────

@app.get("/tags", response_model=list[schemas.TagResponse])
def list_tags(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Tag).filter(models.Tag.user_id == user.id).order_by(models.Tag.name).all()


@app.post("/tags", response_model=schemas.TagResponse, status_code=201)
def create_tag(body: schemas.TagCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")
    if db.query(models.Tag).filter(models.Tag.user_id == user.id, models.Tag.name == name).first():
        raise HTTPException(status_code=400, detail="Tag already exists")
    tag = models.Tag(name=name, user_id=user.id)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@app.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    tag = db.get(models.Tag, tag_id)
    if not tag or tag.user_id != user.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()


# ── Memo routes ────────────────────────────────────

def _resolve_tags(tag_ids: list[int], user_id: int, db: Session) -> list[models.Tag]:
    if not tag_ids:
        return []
    return db.query(models.Tag).filter(
        models.Tag.id.in_(tag_ids), models.Tag.user_id == user_id
    ).all()


@app.get("/memos", response_model=list[schemas.MemoResponse])
def list_memos(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(models.Memo)
        .filter(models.Memo.user_id == user.id)
        .order_by(models.Memo.updated_at.desc())
        .all()
    )


@app.post("/memos", response_model=schemas.MemoResponse, status_code=201)
def create_memo(body: schemas.MemoCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memo = models.Memo(title=body.title, content=body.content, user_id=user.id)
    memo.tags = _resolve_tags(body.tag_ids, user.id, db)
    db.add(memo)
    db.commit()
    db.refresh(memo)
    return memo


@app.get("/memos/{memo_id}", response_model=schemas.MemoResponse)
def get_memo(memo_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memo = db.get(models.Memo, memo_id)
    if not memo or memo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo


@app.put("/memos/{memo_id}", response_model=schemas.MemoResponse)
def update_memo(memo_id: int, body: schemas.MemoUpdate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memo = db.get(models.Memo, memo_id)
    if not memo or memo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Memo not found")
    memo.title = body.title
    memo.content = body.content
    memo.tags = _resolve_tags(body.tag_ids, user.id, db)
    memo.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(memo)
    return memo


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memo = db.get(models.Memo, memo_id)
    if not memo or memo.user_id != user.id:
        raise HTTPException(status_code=404, detail="Memo not found")
    db.delete(memo)
    db.commit()
