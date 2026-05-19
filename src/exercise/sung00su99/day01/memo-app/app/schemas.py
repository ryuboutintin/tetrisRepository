from datetime import datetime
from pydantic import BaseModel, ConfigDict


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    username: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    color: str = "#6366f1"


class CategoryUpdate(BaseModel):
    name: str
    color: str


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: str


# ── Tag ───────────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class TagReadWithCount(TagRead):
    memo_count: int = 0


# ── Memo ──────────────────────────────────────────────────────────────────────

class MemoCreate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False
    category_id: int | None = None
    tag_ids: list[int] = []


class MemoUpdate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False
    category_id: int | None = None
    tag_ids: list[int] = []


class MemoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime | None
    category: CategoryRead | None = None
    tags: list[TagRead] = []
