from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas import MemoCreate, MemoRead, MemoUpdate
import app.crud as crud

router = APIRouter(prefix="/api/v1/memos", tags=["memos"])
DB = Annotated[AsyncSession, Depends(get_db)]


async def _get_or_404(db: DB, memo_id: int) -> crud.Memo:
    memo = await crud.get_memo(db, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    return memo


@router.get("/", response_model=list[MemoRead])
async def list_memos(db: DB, skip: int = 0, limit: int = 20, q: str | None = None):
    return await crud.get_memos(db, skip, limit, q)


@router.post("/", response_model=MemoRead, status_code=status.HTTP_201_CREATED)
async def create_memo(db: DB, body: MemoCreate):
    return await crud.create_memo(db, body)


@router.get("/{memo_id}", response_model=MemoRead)
async def get_memo(db: DB, memo_id: int):
    return await _get_or_404(db, memo_id)


@router.put("/{memo_id}", response_model=MemoRead)
async def update_memo(db: DB, memo_id: int, body: MemoUpdate):
    memo = await _get_or_404(db, memo_id)
    return await crud.update_memo(db, memo, body)


@router.patch("/{memo_id}/pin", response_model=MemoRead)
async def toggle_pin(db: DB, memo_id: int):
    memo = await _get_or_404(db, memo_id)
    return await crud.toggle_pin(db, memo)


@router.delete("/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memo(db: DB, memo_id: int):
    memo = await _get_or_404(db, memo_id)
    await crud.delete_memo(db, memo)
