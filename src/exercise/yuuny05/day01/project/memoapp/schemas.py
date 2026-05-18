from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# ── Auth ──────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


# ── Tag ───────────────────────────────────────────
class TagCreate(BaseModel):
    name: str
    color: Optional[str] = "#ff69b4"


class TagResponse(BaseModel):
    id: int
    name: str
    color: str

    class Config:
        from_attributes = True


# ── Memo ──────────────────────────────────────────
class MemoCreate(BaseModel):
    title: str
    content: str
    tag_ids: Optional[List[int]] = []


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    tags: List[TagResponse] = []

    class Config:
        from_attributes = True
