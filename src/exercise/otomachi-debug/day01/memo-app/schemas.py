from pydantic import BaseModel
from datetime import datetime


class MemoCreate(BaseModel):
    title: str
    content: str = ""


class MemoUpdate(BaseModel):
    title: str
    content: str = ""


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
