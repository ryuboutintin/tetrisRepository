from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from database import Base


class Memo(Base):
    __tablename__ = "memos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, default="")
    tags = Column(String, default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)
