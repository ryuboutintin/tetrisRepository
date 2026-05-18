from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from typing import Optional
import json

from models import Memo, MemoCreate, MemoUpdate
import storage

app = FastAPI(title="메모장 API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 목록 / 검색 ───────────────────────────────────────────────────────────────

@app.get("/memos", response_model=list[Memo])
def list_memos(
    q: Optional[str] = Query(None, description="전문 검색 (FTS5)"),
    tag: Optional[str] = Query(None, description="태그 필터"),
):
    return storage.get_all(q=q, tag=tag)


@app.get("/memos/tags")
def list_tags():
    return storage.get_all_tags()


@app.get("/memos/trash", response_model=list[Memo])
def list_trash():
    return storage.get_trash()


@app.get("/memos/export")
def export_memos():
    data = storage.export_all()
    body = json.dumps(data, ensure_ascii=False, indent=2, default=str)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=memos_export.json"},
    )


# ── 단건 조회 / 수정 / 삭제 (경로 파라미터는 고정 경로 뒤에 선언) ────────────

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
    """소프트 삭제 — 휴지통으로 이동."""
    if not storage.delete(memo_id):
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")


@app.post("/memos/{memo_id}/restore", response_model=Memo)
def restore_memo(memo_id: int):
    memo = storage.restore(memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")
    return memo


@app.delete("/memos/{memo_id}/permanent", status_code=204)
def permanent_delete(memo_id: int):
    if not storage.hard_delete(memo_id):
        raise HTTPException(status_code=404, detail="메모를 찾을 수 없습니다.")


# ── 가져오기 ──────────────────────────────────────────────────────────────────

@app.post("/memos/import", status_code=201)
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
