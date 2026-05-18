from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
import app.crud as crud

router = APIRouter(tags=["views"])
templates = Jinja2Templates(directory="app/templates")
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_class=HTMLResponse)
async def index(request: Request, db: DB, q: str | None = None):
    memos = await crud.get_memos(db, q=q)
    return templates.TemplateResponse(request, "index.html", {"memos": memos, "q": q or ""})


@router.get("/memos/{memo_id}", response_class=HTMLResponse)
async def detail(request: Request, db: DB, memo_id: int):
    memo = await crud.get_memo(db, memo_id)
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    return templates.TemplateResponse(request, "detail.html", {"memo": memo})
