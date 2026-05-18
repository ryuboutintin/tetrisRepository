from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Memo API")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")


# ── CRUD ──────────────────────────────────────────

@app.get("/memos", response_model=list[schemas.MemoResponse])
def list_memos(db: Session = Depends(get_db)):
    return db.query(models.Memo).order_by(models.Memo.updated_at.desc()).all()


@app.post("/memos", response_model=schemas.MemoResponse, status_code=201)
def create_memo(body: schemas.MemoCreate, db: Session = Depends(get_db)):
    memo = models.Memo(**body.model_dump())
    db.add(memo)
    db.commit()
    db.refresh(memo)
    return memo


@app.get("/memos/{memo_id}", response_model=schemas.MemoResponse)
def get_memo(memo_id: int, db: Session = Depends(get_db)):
    memo = db.get(models.Memo, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo


@app.put("/memos/{memo_id}", response_model=schemas.MemoResponse)
def update_memo(memo_id: int, body: schemas.MemoUpdate, db: Session = Depends(get_db)):
    memo = db.get(models.Memo, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    memo.title = body.title
    memo.content = body.content
    db.commit()
    db.refresh(memo)
    return memo


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, db: Session = Depends(get_db)):
    memo = db.get(models.Memo, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    db.delete(memo)
    db.commit()
