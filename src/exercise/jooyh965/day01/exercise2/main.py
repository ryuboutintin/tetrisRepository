from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    revoke_refresh_jti,
    verify_password,
)
from db import get_db, init_db

app = FastAPI(title="Memo API", version="0.3.0")

STATIC_DIR = Path(__file__).parent / "static"

init_db()


class MemoIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="", max_length=10_000)


class MemoUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = Field(default=None, max_length=10_000)


class Memo(MemoIn):
    id: int
    created_at: datetime
    updated_at: datetime


class SignupIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_memo(row) -> Memo:
    return Memo(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@app.post("/auth/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupIn, db=Depends(get_db)):
    existing = db.execute(
        "SELECT 1 FROM users WHERE username = ?", (payload.username,)
    ).fetchone()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Username already taken")

    now = _now_iso()
    cur = db.execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        (payload.username, hash_password(payload.password), now),
    )
    return UserOut(id=cur.lastrowid, username=payload.username, created_at=now)


@app.post("/auth/login", response_model=TokenPair)
def login(form: OAuth2PasswordRequestForm = Depends(), db=Depends(get_db)):
    row = db.execute(
        "SELECT id, password_hash FROM users WHERE username = ?", (form.username,)
    ).fetchone()
    if row is None or not verify_password(form.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = row["id"]
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id, db),
    )


@app.post("/auth/refresh", response_model=TokenPair)
def refresh(payload: RefreshIn, db=Depends(get_db)):
    decoded = decode_token(payload.refresh_token, "refresh")
    jti = decoded.get("jti")
    user_id = int(decoded["sub"])

    row = db.execute(
        "SELECT revoked FROM refresh_tokens WHERE jti = ?", (jti,)
    ).fetchone()
    if row is None or row["revoked"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked or unknown",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # rotate: old refresh token can no longer be used
    revoke_refresh_jti(jti, db)
    return TokenPair(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id, db),
    )


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshIn, db=Depends(get_db)):
    try:
        decoded = decode_token(payload.refresh_token, "refresh")
    except HTTPException:
        # logging out with an already-invalid token is a no-op
        return None
    revoke_refresh_jti(decoded["jti"], db)
    return None


@app.get("/auth/me", response_model=UserOut)
def me(user=Depends(get_current_user)):
    return UserOut(**user)


# ---------------------------------------------------------------------------
# Memos (protected)
# ---------------------------------------------------------------------------


@app.get("/memos", response_model=list[Memo])
def list_memos(db=Depends(get_db), _user=Depends(get_current_user)):
    rows = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos ORDER BY id DESC"
    ).fetchall()
    return [_row_to_memo(r) for r in rows]


@app.get("/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int, db=Depends(get_db), _user=Depends(get_current_user)):
    row = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos WHERE id = ?",
        (memo_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return _row_to_memo(row)


@app.post("/memos", response_model=Memo, status_code=status.HTTP_201_CREATED)
def create_memo(payload: MemoIn, db=Depends(get_db), _user=Depends(get_current_user)):
    now = _now_iso()
    cur = db.execute(
        "INSERT INTO memos (title, content, created_at, updated_at) "
        "VALUES (?, ?, ?, ?)",
        (payload.title, payload.content, now, now),
    )
    row = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos WHERE id = ?",
        (cur.lastrowid,),
    ).fetchone()
    return _row_to_memo(row)


@app.put("/memos/{memo_id}", response_model=Memo)
def update_memo(
    memo_id: int,
    payload: MemoUpdate,
    db=Depends(get_db),
    _user=Depends(get_current_user),
):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    existing = db.execute(
        "SELECT 1 FROM memos WHERE id = ?", (memo_id,)
    ).fetchone()
    if existing is None:
        raise HTTPException(status_code=404, detail="Memo not found")

    set_clause = ", ".join(f"{col} = ?" for col in updates)
    params = [*updates.values(), _now_iso(), memo_id]
    db.execute(
        f"UPDATE memos SET {set_clause}, updated_at = ? WHERE id = ?",
        params,
    )
    row = db.execute(
        "SELECT id, title, content, created_at, updated_at "
        "FROM memos WHERE id = ?",
        (memo_id,),
    ).fetchone()
    return _row_to_memo(row)


@app.delete("/memos/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memo(memo_id: int, db=Depends(get_db), _user=Depends(get_current_user)):
    cur = db.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")
    return None


@app.get("/")
def login_page():
    return FileResponse(STATIC_DIR / "login.html")


@app.get("/app")
def memo_app():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
