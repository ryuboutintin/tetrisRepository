from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Query, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from typing import Optional
import json

from models import Memo, MemoCreate, MemoUpdate, UserCreate, Token
from auth import get_current_user, hash_password, verify_password, create_token
import storage

app = FastAPI(title="메모장 API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 인증 ──────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=Token, status_code=201)
def register(body: UserCreate):
    if storage.get_user(body.username):
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디입니다.")
    storage.create_user(body.username, hash_password(body.password))
    return Token(access_token=create_token(body.username))


@app.post("/auth/login", response_model=Token)
def login(body: UserCreate):
    user = storage.get_user(body.username)
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    return Token(access_token=create_token(body.username))


# ── 메모 라우터 (전체 인증 필요) ──────────────────────────────────────────────

memos = APIRouter(prefix="/memos", dependencies=[Depends(get_current_user)])


@memos.get("", response_model=list[Memo])
def list_memos(
    q: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
):
    return storage.get_all(q=q, tag=tag)


@memos.get("/tags")
def list_tags():
    return storage.get_all_tags()


@memos.get("/trash", response_model=list[Memo])
def list_trash():
    return storage.get_trash()


@memos.get("/export")
def export_memos():
    data = storage.export_all()
    body = json.dumps(data, ensure_ascii=False, indent=2, default=str)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=memos_export.json"},
    )


@memos.get("/{memo_id}", response_model=Memo)
def get_memo(memo_id: int):
    memo = storage.get_by_id(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return memo


@memos.post("", response_model=Memo, status_code=201)
def create_memo(body: MemoCreate):
    now = datetime.now(timezone.utc).isoformat()
    data = body.model_dump()
    data["created_at"] = now
    data["updated_at"] = now
    return storage.create(data)


@memos.put("/{memo_id}", response_model=Memo)
def update_memo(memo_id: int, body: MemoUpdate):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    memo = storage.update(memo_id, changes)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return memo


@memos.delete("/{memo_id}", status_code=204)
def delete_memo(memo_id: int):
    if not storage.delete(memo_id):
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")


@memos.post("/{memo_id}/restore", response_model=Memo)
def restore_memo(memo_id: int):
    memo = storage.restore(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return memo


@memos.delete("/{memo_id}/permanent", status_code=204)
def permanent_delete(memo_id: int):
    if not storage.hard_delete(memo_id):
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")


@memos.post("/import", status_code=201)
async def import_memos(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=400, detail="JSON 배열 형식의 파일만 허용됩니다.")
    count = storage.import_memos(data)
    return {"imported": count}


app.include_router(memos)
