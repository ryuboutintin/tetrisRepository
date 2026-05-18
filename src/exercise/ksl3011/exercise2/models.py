from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class MemoCreate(BaseModel):
    content: str
    title: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)


class MemoUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    tags: Optional[List[str]] = None


class Memo(BaseModel):
    id: int
    content: str
    title: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
