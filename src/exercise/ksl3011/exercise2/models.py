from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class MemoCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)
    title: Optional[str] = Field(None, max_length=200)
    tags: Optional[List[str]] = Field(default_factory=list, max_length=10)


class MemoUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=50000)
    title: Optional[str] = Field(None, max_length=200)
    tags: Optional[List[str]] = Field(None, max_length=10)


class Memo(BaseModel):
    id: int
    content: str
    title: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
