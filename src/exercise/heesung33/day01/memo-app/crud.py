from datetime import datetime

from sqlalchemy.orm import Session

from models import Memo, Tag, User
from schemas import MemoCreate, MemoUpdate


def get_or_create_tags(db: Session, tag_names: list[str]) -> list[Tag]:
    tags = []
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def create_memo(db: Session, memo: MemoCreate, user: User) -> Memo:
    tags = get_or_create_tags(db, memo.tags)
    db_memo = Memo(
        title=memo.title,
        content=memo.content,
        category=memo.category,
        owner_id=user.id,
        tags=tags,
    )
    db.add(db_memo)
    db.commit()
    db.refresh(db_memo)
    return db_memo


def get_memos(db: Session, user: User) -> list[Memo]:
    return (
        db.query(Memo)
        .filter(Memo.owner_id == user.id)
        .order_by(Memo.created_at.desc())
        .all()
    )


def get_memo(db: Session, memo_id: int, user: User) -> Memo | None:
    return (
        db.query(Memo)
        .filter(Memo.id == memo_id, Memo.owner_id == user.id)
        .first()
    )


def update_memo(db: Session, memo_id: int, memo: MemoUpdate, user: User) -> Memo | None:
    db_memo = (
        db.query(Memo)
        .filter(Memo.id == memo_id, Memo.owner_id == user.id)
        .first()
    )
    if db_memo is None:
        return None
    db_memo.title = memo.title
    db_memo.content = memo.content
    db_memo.category = memo.category
    db_memo.tags = get_or_create_tags(db, memo.tags)
    db_memo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_memo)
    return db_memo


def delete_memo(db: Session, memo_id: int, user: User) -> bool:
    db_memo = (
        db.query(Memo)
        .filter(Memo.id == memo_id, Memo.owner_id == user.id)
        .first()
    )
    if db_memo is None:
        return False
    db.delete(db_memo)
    db.commit()
    return True
