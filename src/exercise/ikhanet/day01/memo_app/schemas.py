from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MemoCreate(BaseModel):
    title: str
    content: str = ""
    tags: str = ""


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    tags: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
