from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from database import Base


def _now():
    # SQLite는 naive UTC로 저장 — 비교 시 datetime.utcnow() 사용
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    created_at      = Column(DateTime(timezone=True), default=_now)

    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    """DB에 저장된 refresh token. 로그아웃·토큰 로테이션 시 revoked=True 처리."""

    __tablename__ = "refresh_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    token      = Column(Text, unique=True, nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked    = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)

    user = relationship("User", back_populates="refresh_tokens")
