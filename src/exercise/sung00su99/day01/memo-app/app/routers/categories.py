from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate
import app.crud as crud

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/", response_model=list[CategoryRead])
async def list_categories(db: DB, current_user: CurrentUser):
    return await crud.get_categories(db, current_user.id)


@router.post("/", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(db: DB, current_user: CurrentUser, body: CategoryCreate):
    return await crud.create_category(db, body, current_user.id)


@router.put("/{cat_id}", response_model=CategoryRead)
async def update_category(db: DB, current_user: CurrentUser, cat_id: int, body: CategoryUpdate):
    cat = await crud.get_category(db, cat_id, current_user.id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return await crud.update_category(db, cat, body)


@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(db: DB, current_user: CurrentUser, cat_id: int):
    cat = await crud.get_category(db, cat_id, current_user.id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await crud.delete_category(db, cat)
