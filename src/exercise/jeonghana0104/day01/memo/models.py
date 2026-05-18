from pydantic import BaseModel, Field


class MemoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=20000)


class MemoUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=20000)


class Memo(BaseModel):
    id: int
    title: str
    content: str
    created_at: str
    updated_at: str
