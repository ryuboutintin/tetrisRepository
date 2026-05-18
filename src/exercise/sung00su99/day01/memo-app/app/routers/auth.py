from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token, create_refresh_token, verify_token,
    get_current_user, get_password_hash, verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import AccessTokenResponse, RefreshRequest, TokenResponse, UserCreate, UserRead
import app.crud as crud

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(db: DB, body: UserCreate):
    existing = await db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email or username already registered")
    return await crud.create_user(db, body, get_password_hash(body.password))


@router.post("/token", response_model=TokenResponse)
async def login(db: DB, form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = await crud.get_user_by_username(db, form.username)
    if not user or not verify_password(form.password, user.hashed_pw):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(body: RefreshRequest):
    payload = verify_token(body.refresh_token, token_type="refresh")
    return AccessTokenResponse(
        access_token=create_access_token({"sub": payload["sub"]})
    )


@router.get("/me", response_model=UserRead)
async def me(current_user: CurrentUser):
    return current_user
