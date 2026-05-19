from datetime import datetime
from pydantic import BaseModel, field_validator

from auth import ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS


class UserCreate(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("사용자명은 3자 이상이어야 합니다.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("비밀번호는 6자 이상이어야 합니다.")
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    model_config = {"from_attributes": True}


class TokenPair(BaseModel):
    """로그인·회원가입·refresh 응답 — access + refresh 토큰 쌍."""
    access_token:             str
    refresh_token:            str
    token_type:               str = "bearer"
    access_expires_in:        int = ACCESS_TOKEN_EXPIRE_MINUTES * 60   # seconds
    refresh_expires_in:       int = REFRESH_TOKEN_EXPIRE_DAYS * 86400  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str
