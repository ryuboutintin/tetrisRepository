from datetime import datetime, timezone
from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Memo, Tag, User, memo_tags
from app.schemas import (
    CategoryCreate, CategoryUpdate,
    MemoCreate, MemoUpdate,
    TagCreate, UserCreate,
)


# ── 공통 헬퍼 ────────────────────────────────────────────────────────────────

async def _reload_memo(db: AsyncSession, memo_id: int) -> Memo:
    """tags/category selectin 포함 Memo 재조회."""
    result = await db.execute(select(Memo).where(Memo.id == memo_id))
    return result.scalar_one()


# ── User ─────────────────────────────────────────────────────────────────────

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, data: UserCreate, hashed_pw: str) -> User:
    user = User(email=data.email, username=data.username, hashed_pw=hashed_pw)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Category ─────────────────────────────────────────────────────────────────

async def get_categories(db: AsyncSession, owner_id: int) -> list[Category]:
    result = await db.execute(select(Category).where(Category.owner_id == owner_id))
    return list(result.scalars().all())


async def get_category(db: AsyncSession, cat_id: int, owner_id: int) -> Category | None:
    result = await db.execute(
        select(Category).where(Category.id == cat_id, Category.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_category(db: AsyncSession, data: CategoryCreate, owner_id: int) -> Category:
    cat = Category(name=data.name, color=data.color, owner_id=owner_id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


async def update_category(db: AsyncSession, cat: Category, data: CategoryUpdate) -> Category:
    cat.name = data.name
    cat.color = data.color
    await db.commit()
    await db.refresh(cat)
    return cat


async def delete_category(db: AsyncSession, cat: Category) -> None:
    # 연결된 메모의 category_id를 NULL 처리
    memos_result = await db.execute(select(Memo).where(Memo.category_id == cat.id))
    for memo in memos_result.scalars():
        memo.category_id = None
    await db.delete(cat)
    await db.commit()


# ── Tag ──────────────────────────────────────────────────────────────────────

async def get_tags_with_count(db: AsyncSession, owner_id: int) -> list[dict]:
    stmt = (
        select(Tag, func.count(memo_tags.c.memo_id).label("memo_count"))
        .outerjoin(memo_tags, Tag.id == memo_tags.c.tag_id)
        .where(Tag.owner_id == owner_id)
        .group_by(Tag.id)
    )
    rows = (await db.execute(stmt)).all()
    return [{"id": r.Tag.id, "name": r.Tag.name, "memo_count": r.memo_count} for r in rows]


async def get_tag(db: AsyncSession, tag_id: int, owner_id: int) -> Tag | None:
    result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.owner_id == owner_id)
    )
    return result.scalar_one_or_none()


async def create_tag(db: AsyncSession, data: TagCreate, owner_id: int) -> Tag:
    tag = Tag(name=data.name, owner_id=owner_id)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


async def delete_tag(db: AsyncSession, tag: Tag) -> None:
    await db.delete(tag)
    await db.commit()


async def _resolve_tags(db: AsyncSession, tag_ids: list[int], owner_id: int) -> list[Tag]:
    if not tag_ids:
        return []
    result = await db.execute(
        select(Tag).where(Tag.id.in_(tag_ids), Tag.owner_id == owner_id)
    )
    return list(result.scalars().all())


# ── Memo ─────────────────────────────────────────────────────────────────────

async def get_memos(
    db: AsyncSession,
    owner_id: int,
    skip: int = 0,
    limit: int = 20,
    q: str | None = None,
    category_id: int | None = None,
    tag_ids: list[int] | None = None,
) -> list[Memo]:
    stmt = select(Memo).where(Memo.owner_id == owner_id)
    if q:
        stmt = stmt.where(or_(Memo.title.ilike(f"%{q}%"), Memo.content.ilike(f"%{q}%")))
    if category_id is not None:
        stmt = stmt.where(Memo.category_id == category_id)
    if tag_ids:
        for tid in tag_ids:
            stmt = stmt.where(
                exists().where(memo_tags.c.memo_id == Memo.id, memo_tags.c.tag_id == tid)
            )
    stmt = stmt.order_by(Memo.is_pinned.desc(), Memo.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_memo(db: AsyncSession, memo_id: int) -> Memo | None:
    result = await db.execute(select(Memo).where(Memo.id == memo_id))
    return result.scalar_one_or_none()


async def create_memo(db: AsyncSession, data: MemoCreate, owner_id: int) -> Memo:
    tag_ids = data.tag_ids
    memo = Memo(**data.model_dump(exclude={"tag_ids"}), owner_id=owner_id)
    memo.tags = await _resolve_tags(db, tag_ids, owner_id)
    db.add(memo)
    await db.commit()
    return await _reload_memo(db, memo.id)


async def update_memo(db: AsyncSession, memo: Memo, data: MemoUpdate, owner_id: int) -> Memo:
    tag_ids = data.tag_ids
    for key, value in data.model_dump(exclude={"tag_ids"}).items():
        setattr(memo, key, value)
    memo.updated_at = datetime.now(timezone.utc)
    memo.tags = await _resolve_tags(db, tag_ids, owner_id)
    await db.commit()
    return await _reload_memo(db, memo.id)


async def toggle_pin(db: AsyncSession, memo: Memo) -> Memo:
    memo.is_pinned = not memo.is_pinned
    memo.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await _reload_memo(db, memo.id)


async def delete_memo(db: AsyncSession, memo: Memo) -> None:
    await db.delete(memo)
    await db.commit()
