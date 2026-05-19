from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Tag, User
from app.schemas import TagCreate, TagReadWithCount
import app.crud as crud

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/", response_model=list[TagReadWithCount])
async def list_tags(db: DB, current_user: CurrentUser):
    rows = await crud.get_tags_with_count(db, current_user.id)
    return [TagReadWithCount(**r) for r in rows]


@router.post("/", response_model=TagReadWithCount, status_code=status.HTTP_201_CREATED)
async def create_tag(db: DB, current_user: CurrentUser, body: TagCreate):
    existing = await db.execute(
        select(Tag).where(Tag.name == body.name, Tag.owner_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tag already exists")
    tag = await crud.create_tag(db, body, current_user.id)
    return TagReadWithCount(id=tag.id, name=tag.name, memo_count=0)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(db: DB, current_user: CurrentUser, tag_id: int):
    tag = await crud.get_tag(db, tag_id, current_user.id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await crud.delete_tag(db, tag)
