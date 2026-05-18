from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MemoCreate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False


class MemoUpdate(BaseModel):
    title: str
    content: str
    is_pinned: bool = False


class MemoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime | None
