from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from typing import List

import models, schemas, crud
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

templates = Jinja2Templates(directory="templates")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/memos/", response_model=schemas.Memo)
def create_memo(memo: schemas.MemoCreate, db: Session = Depends(get_db)):
    return crud.create_memo(db=db, memo=memo)

@app.get("/memos/", response_model=List[schemas.Memo])
def read_memos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    memos = crud.get_memos(db, skip=skip, limit=limit)
    return memos

@app.get("/memos/{memo_id}", response_model=schemas.Memo)
def read_memo(memo_id: int, db: Session = Depends(get_db)):
    db_memo = crud.get_memo(db, memo_id=memo_id)
    if db_memo is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return db_memo

@app.put("/memos/{memo_id}", response_model=schemas.Memo)
def update_memo(memo_id: int, memo: schemas.MemoUpdate, db: Session = Depends(get_db)):
    db_memo = crud.update_memo(db, memo_id=memo_id, memo=memo)
    if db_memo is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return db_memo

@app.delete("/memos/{memo_id}", response_model=schemas.Memo)
def delete_memo(memo_id: int, db: Session = Depends(get_db)):
    db_memo = crud.delete_memo(db, memo_id=memo_id)
    if db_memo is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return db_memo
