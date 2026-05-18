from datetime import datetime, timezone
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Memo
from app.schemas import MemoCreate, MemoUpdate


async def get_memos(db: AsyncSession, skip: int = 0, limit: int = 20, q: str | None = None) -> list[Memo]:
    stmt = select(Memo)
    if q:
        stmt = stmt.where(or_(Memo.title.ilike(f"%{q}%"), Memo.content.ilike(f"%{q}%")))
    stmt = stmt.order_by(Memo.is_pinned.desc(), Memo.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_memo(db: AsyncSession, memo_id: int) -> Memo | None:
    result = await db.execute(select(Memo).where(Memo.id == memo_id))
    return result.scalar_one_or_none()


async def create_memo(db: AsyncSession, data: MemoCreate) -> Memo:
    memo = Memo(**data.model_dump())
    db.add(memo)
    await db.commit()
    await db.refresh(memo)
    return memo


async def update_memo(db: AsyncSession, memo: Memo, data: MemoUpdate) -> Memo:
    for key, value in data.model_dump().items():
        setattr(memo, key, value)
    memo.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(memo)
    return memo


async def toggle_pin(db: AsyncSession, memo: Memo) -> Memo:
    memo.is_pinned = not memo.is_pinned
    memo.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(memo)
    return memo


async def delete_memo(db: AsyncSession, memo: Memo) -> None:
    await db.delete(memo)
    await db.commit()
