from typing import Optional

from pydantic import BaseModel, Field


# ---- Auth ----
class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4, max_length=200)


class LoginRequest(BaseModel):
    username: str
    password: str


class User(BaseModel):
    id: int
    username: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


# ---- Category ----
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(default="#d97757", max_length=20)


class CategoryUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(default="#d97757", max_length=20)


class Category(BaseModel):
    id: int
    name: str
    color: str


# ---- Tag ----
class Tag(BaseModel):
    id: int
    name: str


# ---- Memo ----
class MemoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=20000)
    category_id: Optional[int] = None
    tags: list[str] = Field(default_factory=list)


class MemoUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=20000)
    category_id: Optional[int] = None
    tags: list[str] = Field(default_factory=list)


class Memo(BaseModel):
    id: int
    title: str
    content: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str
