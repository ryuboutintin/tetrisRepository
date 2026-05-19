from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Many-to-Many: Memo ↔ Tag ──────────────────────────────────────────────────
memo_tags = Table(
    "memo_tags",
    Base.metadata,
    Column("memo_id", Integer, ForeignKey("memos.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id",  Integer, ForeignKey("tags.id",  ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    email:      Mapped[str]      = mapped_column(String(255), unique=True, nullable=False)
    username:   Mapped[str]      = mapped_column(String(50),  unique=True, nullable=False)
    hashed_pw:  Mapped[str]      = mapped_column(String(255), nullable=False)
    is_active:  Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    memos:      Mapped[list["Memo"]]     = relationship("Memo",     back_populates="owner",    cascade="all, delete-orphan")
    categories: Mapped[list["Category"]] = relationship("Category", back_populates="owner",    cascade="all, delete-orphan")
    tags:       Mapped[list["Tag"]]      = relationship("Tag",      back_populates="owner",    cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id:       Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:     Mapped[str] = mapped_column(String(50), nullable=False)
    color:    Mapped[str] = mapped_column(String(7), default="#6366f1")
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    owner: Mapped["User"]        = relationship("User",  back_populates="categories")
    memos: Mapped[list["Memo"]]  = relationship("Memo",  back_populates="category")


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("name", "owner_id"),)

    id:       Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:     Mapped[str] = mapped_column(String(50), nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="tags")


class Memo(Base):
    __tablename__ = "memos"

    id:          Mapped[int]           = mapped_column(Integer, primary_key=True, autoincrement=True)
    title:       Mapped[str]           = mapped_column(String(200), nullable=False)
    content:     Mapped[str]           = mapped_column(Text, nullable=False)
    is_pinned:   Mapped[bool]          = mapped_column(Boolean, default=False)
    created_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    owner_id:    Mapped[int]           = mapped_column(Integer, ForeignKey("users.id"), nullable=False, server_default="1")
    category_id: Mapped[int | None]    = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)

    owner:    Mapped["User"]           = relationship("User",     back_populates="memos")
    category: Mapped["Category | None"] = relationship("Category", back_populates="memos",  lazy="selectin")
    tags:     Mapped[list["Tag"]]       = relationship("Tag",      secondary=memo_tags,      lazy="selectin")
