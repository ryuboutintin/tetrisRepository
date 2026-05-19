from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from database import Base


def now_utc():
    return datetime.now(timezone.utc)


memo_tags = Table(
    "memo_tags",
    Base.metadata,
    Column("memo_id", Integer, ForeignKey("memos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id",  Integer, ForeignKey("tags.id",  ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    memos = relationship("Memo", back_populates="owner", cascade="all, delete-orphan")
    tags  = relationship("Tag",  back_populates="owner", cascade="all, delete-orphan")


class Tag(Base):
    __tablename__ = "tags"
    id      = Column(Integer, primary_key=True, index=True)
    name    = Column(String(50), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    owner = relationship("User", back_populates="tags")
    memos = relationship("Memo", secondary=memo_tags, back_populates="tags")


class Memo(Base):
    __tablename__ = "memos"
    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String(200), nullable=False)
    content    = Column(Text, default="")
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    owner = relationship("User", back_populates="memos")
    tags  = relationship("Tag", secondary=memo_tags, back_populates="memos")
