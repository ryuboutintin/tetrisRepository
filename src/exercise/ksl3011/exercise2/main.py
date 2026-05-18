from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from models import Memo, MemoCreate, MemoUpdate
import storage

app = FastAPI(title="메모장 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/memos", response_model=list[Memo])
def list_memos():
    return storage.get_all()


@app.get("/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int):
    memo = storage.get_by_id(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return memo


@app.post("/memos", response_model=Memo, status_code=201)
def create_memo(body: MemoCreate):
    now = datetime.now(timezone.utc).isoformat()
    data = body.model_dump()
    data["created_at"] = now
    data["updated_at"] = now
    return storage.create(data)


@app.put("/memos/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, body: MemoUpdate):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    memo = storage.update(memo_id, changes)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return memo


@app.delete("/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    if not storage.delete(memo_id):
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
