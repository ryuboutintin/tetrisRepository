from pydantic import BaseModel, field_validator
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_not_empty(cls, v):
        if not v.strip():
            raise ValueError("username cannot be empty")
        return v.strip()


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TagCreate(BaseModel):
    name: str


class TagResponse(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class MemoCreate(BaseModel):
    title: str
    content: str = ""
    tag_ids: list[int] = []


class MemoUpdate(BaseModel):
    title: str
    content: str = ""
    tag_ids: list[int] = []


class MemoResponse(BaseModel):
    id: int
    title: str
    content: str
    tags: list[TagResponse] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
