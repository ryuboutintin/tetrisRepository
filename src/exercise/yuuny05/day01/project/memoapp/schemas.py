from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MemoCreate(BaseModel):
    title: str
    content: str


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
