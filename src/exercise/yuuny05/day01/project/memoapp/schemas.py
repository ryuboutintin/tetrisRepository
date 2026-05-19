from pydantic import BaseModel, ConfigDict, model_validator
from datetime import datetime
from typing import Optional, List, Any

# 찻집 카테고리 목록 — 코드에서 단일 출처로 관리
CATEGORIES: List[str] = [
    "🍵 차 메뉴",
    "🌿 재료 & 다구",
    "📖 레시피",
    "🫖 다도 & 문화",
    "👥 손님 응대",
    "📊 운영 & 관리",
    "🎉 이벤트 & 행사",
    "💡 아이디어",
    "📝 기타",
]


# ── Auth ──────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ── Memo ──────────────────────────────────────────────────────────────
class MemoCreate(BaseModel):
    title: str
    content: str
    category: Optional[str] = None   # 드롭다운 1개 선택
    tags: List[str] = []             # 자유 입력 문자열 목록


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class MemoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    category: Optional[str] = None
    tags: List[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    @model_validator(mode='before')
    @classmethod
    def flatten_tags(cls, v: Any) -> Any:
        """SQLAlchemy MemoTag 객체 목록을 문자열 목록으로 변환."""
        if isinstance(v, dict):
            return v
        return {
            'id': v.id,
            'title': v.title,
            'content': v.content,
            'category': v.category,
            'tags': [t.name for t in (v.tags or [])],
            'created_at': v.created_at,
            'updated_at': v.updated_at,
        }
