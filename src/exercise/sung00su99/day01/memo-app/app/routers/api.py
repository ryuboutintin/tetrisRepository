from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Memo, User
from app.schemas import MemoCreate, MemoRead, MemoUpdate
import app.crud as crud

router = APIRouter(prefix="/api/v1/memos", tags=["memos"])
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _get_own_memo(db: DB, memo_id: int, current_user: CurrentUser) -> Memo:
    memo = await crud.get_memo(db, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    if memo.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return memo


@router.get("/", response_model=list[MemoRead])
async def list_memos(
    db: DB,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
    q: str | None = None,
    category_id: int | None = None,
    tag_ids: list[int] = Query(default=[]),
):
    return await crud.get_memos(
        db, owner_id=current_user.id,
        skip=skip, limit=limit, q=q,
        category_id=category_id, tag_ids=tag_ids or None,
    )


@router.post("/", response_model=MemoRead, status_code=status.HTTP_201_CREATED)
async def create_memo(db: DB, current_user: CurrentUser, body: MemoCreate):
    return await crud.create_memo(db, body, owner_id=current_user.id)


@router.get("/{memo_id}", response_model=MemoRead)
async def get_memo(db: DB, current_user: CurrentUser, memo_id: int):
    return await _get_own_memo(db, memo_id, current_user)


@router.put("/{memo_id}", response_model=MemoRead)
async def update_memo(db: DB, current_user: CurrentUser, memo_id: int, body: MemoUpdate):
    memo = await _get_own_memo(db, memo_id, current_user)
    return await crud.update_memo(db, memo, body, owner_id=current_user.id)


@router.patch("/{memo_id}/pin", response_model=MemoRead)
async def toggle_pin(db: DB, current_user: CurrentUser, memo_id: int):
    memo = await _get_own_memo(db, memo_id, current_user)
    return await crud.toggle_pin(db, memo)


@router.delete("/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memo(db: DB, current_user: CurrentUser, memo_id: int):
    memo = await _get_own_memo(db, memo_id, current_user)
    await crud.delete_memo(db, memo)
