from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class MemoBase(BaseModel):
    title: str
    content: str

class MemoCreate(MemoBase):
    pass

class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class Memo(MemoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True # For Pydantic v2
