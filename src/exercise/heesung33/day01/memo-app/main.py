from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from sqlalchemy.orm import Session

from database import engine, get_db, Base
from schemas import MemoCreate, MemoUpdate, MemoRead
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


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/memos", response_model=MemoRead, status_code=201)
def create_memo(memo: MemoCreate, db: Session = Depends(get_db)):
    return crud.create_memo(db, memo)


@app.get("/memos", response_model=list[MemoRead])
def read_memos(db: Session = Depends(get_db)):
    return crud.get_memos(db)


@app.get("/memos/{memo_id}", response_model=MemoRead)
def read_memo(memo_id: int, db: Session = Depends(get_db)):
    db_memo = crud.get_memo(db, memo_id)
    if db_memo is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return db_memo


@app.put("/memos/{memo_id}", response_model=MemoRead)
def update_memo(memo_id: int, memo: MemoUpdate, db: Session = Depends(get_db)):
    db_memo = crud.update_memo(db, memo_id, memo)
    if db_memo is None:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return db_memo


@app.delete("/memos/{memo_id}")
def delete_memo(memo_id: int, db: Session = Depends(get_db)):
    success = crud.delete_memo(db, memo_id)
    if not success:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다")
    return {"message": "메모가 삭제되었습니다"}
