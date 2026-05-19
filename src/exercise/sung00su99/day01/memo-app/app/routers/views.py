from typing import Annotated
from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_token
from app.database import get_db
from app.models import User
import app.crud as crud

router = APIRouter(tags=["views"])
templates = Jinja2Templates(directory="app/templates")
DB = Annotated[AsyncSession, Depends(get_db)]


async def _user_from_cookie(db: AsyncSession, token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload = verify_token(token)
        sub = payload.get("sub")
        if not sub:
            return None
        result = await db.execute(select(User).where(User.id == int(sub)))
        return result.scalar_one_or_none()
    except Exception:
        return None


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request, "auth/login.html", {})


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse(request, "auth/register.html", {})


@router.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    db: DB,
    q: str | None = None,
    category_id: int | None = None,
    tag_ids: list[int] = Query(default=[]),
    token: str | None = Cookie(None),
):
    user = await _user_from_cookie(db, token)
    if not user:
        return RedirectResponse("/login", status_code=302)

    memos = await crud.get_memos(
        db, owner_id=user.id, q=q,
        category_id=category_id, tag_ids=tag_ids or None,
    )
    categories = await crud.get_categories(db, user.id)
    tag_rows = await crud.get_tags_with_count(db, user.id)

    return templates.TemplateResponse(request, "index.html", {
        "memos": memos,
        "categories": categories,
        "tags": tag_rows,
        "q": q or "",
        "category_id": category_id,
        "selected_tag_ids": tag_ids,
        "current_user": user,
    })


@router.get("/memos/{memo_id}", response_class=HTMLResponse)
async def detail(
    request: Request,
    db: DB,
    memo_id: int,
    token: str | None = Cookie(None),
):
    user = await _user_from_cookie(db, token)
    if not user:
        return RedirectResponse("/login", status_code=302)

    memo = await crud.get_memo(db, memo_id)
    if not memo or memo.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Memo not found")

    categories = await crud.get_categories(db, user.id)
    tag_rows = await crud.get_tags_with_count(db, user.id)

    return templates.TemplateResponse(request, "detail.html", {
        "memo": memo,
        "categories": categories,
        "tags": tag_rows,
        "current_user": user,
    })
