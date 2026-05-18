import os
from datetime import datetime
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="Memo API")
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


@app.get("/")
def root():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))


@app.get("/memos", response_model=List[schemas.MemoResponse])
def list_memos(db: Session = Depends(get_db)):
    return db.query(models.Memo).order_by(models.Memo.created_at.desc()).all()


@app.post("/memos", response_model=schemas.MemoResponse, status_code=201)
def create_memo(memo: schemas.MemoCreate, db: Session = Depends(get_db)):
    db_memo = models.Memo(**memo.model_dump())
    db.add(db_memo)
    db.commit()
    db.refresh(db_memo)
    return db_memo


@app.get("/memos/{memo_id}", response_model=schemas.MemoResponse)
def get_memo(memo_id: int, db: Session = Depends(get_db)):
    memo = db.query(models.Memo).filter(models.Memo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo


@app.put("/memos/{memo_id}", response_model=schemas.MemoResponse)
def update_memo(memo_id: int, memo_update: schemas.MemoUpdate, db: Session = Depends(get_db)):
    memo = db.query(models.Memo).filter(models.Memo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    for key, value in memo_update.model_dump(exclude_unset=True).items():
        setattr(memo, key, value)
    memo.updated_at = datetime.now()
    db.commit()
    db.refresh(memo)
    return memo


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, db: Session = Depends(get_db)):
    memo = db.query(models.Memo).filter(models.Memo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    db.delete(memo)
    db.commit()
