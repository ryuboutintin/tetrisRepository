from datetime import datetime
from pydantic import BaseModel


# --- 사용자 인증 ---
class UserCreate(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


# --- 태그 ---
class TagRead(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


# --- 메모 ---
class MemoCreate(BaseModel):
    title: str
    content: str
    category: str = "일반"
    tags: list[str] = []


class MemoUpdate(BaseModel):
    title: str
    content: str
    category: str = "일반"
    tags: list[str] = []


class MemoRead(BaseModel):
    id: int
    title: str
    content: str
    category: str
    tags: list[TagRead] = []
    created_at: datetime
    updated_at: datetime
    owner_id: int

    model_config = {"from_attributes": True}
