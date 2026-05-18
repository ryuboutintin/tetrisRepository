from datetime import datetime

from sqlalchemy.orm import Session

from models import Memo
from schemas import MemoCreate, MemoUpdate


def create_memo(db: Session, memo: MemoCreate) -> Memo:
    db_memo = Memo(title=memo.title, content=memo.content)
    db.add(db_memo)
    db.commit()
    db.refresh(db_memo)
    return db_memo


def get_memos(db: Session) -> list[Memo]:
    return db.query(Memo).order_by(Memo.created_at.desc()).all()


def get_memo(db: Session, memo_id: int) -> Memo | None:
    return db.query(Memo).filter(Memo.id == memo_id).first()


def update_memo(db: Session, memo_id: int, memo: MemoUpdate) -> Memo | None:
    db_memo = db.query(Memo).filter(Memo.id == memo_id).first()
    if db_memo is None:
        return None
    db_memo.title = memo.title
    db_memo.content = memo.content
    db_memo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_memo)
    return db_memo


def delete_memo(db: Session, memo_id: int) -> bool:
    db_memo = db.query(Memo).filter(Memo.id == memo_id).first()
    if db_memo is None:
        return False
    db.delete(db_memo)
    db.commit()
    return True
