import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from auth import create_token, get_current_user, hash_password, verify_password
from database import get_conn, init_db
from models import (
    Category,
    CategoryCreate,
    CategoryUpdate,
    LoginRequest,
    Memo,
    MemoCreate,
    MemoUpdate,
    Tag,
    Token,
    User,
    UserCreate,
)

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Claude Memo", version="2.0.0")


@app.on_event("startup")
def _startup() -> None:
    init_db()


# ---------------- Auth ----------------
@app.post("/api/auth/register", response_model=Token, status_code=201)
def register(payload: UserCreate) -> Token:
    pw_hash = hash_password(payload.password)
    with get_conn() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (payload.username, pw_hash),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
        user_id = cursor.lastrowid
    token = create_token(user_id, payload.username)
    return Token(access_token=token, user=User(id=user_id, username=payload.username))


@app.post("/api/auth/login", response_model=Token)
def login(payload: LoginRequest) -> Token:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (payload.username,),
        ).fetchone()
    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token = create_token(row["id"], row["username"])
    return Token(access_token=token, user=User(id=row["id"], username=row["username"]))


@app.get("/api/auth/me", response_model=User)
def me(current_user: dict = Depends(get_current_user)) -> User:
    return User(id=current_user["id"], username=current_user["username"])


# ---------------- Categories ----------------
@app.get("/api/categories", response_model=list[Category])
def list_categories(current_user: dict = Depends(get_current_user)) -> list[Category]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, color FROM categories WHERE user_id = ? ORDER BY name",
            (current_user["id"],),
        ).fetchall()
    return [Category(**dict(r)) for r in rows]


@app.post("/api/categories", response_model=Category, status_code=201)
def create_category(
    payload: CategoryCreate, current_user: dict = Depends(get_current_user)
) -> Category:
    with get_conn() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)",
                (current_user["id"], payload.name, payload.color),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status.HTTP_409_CONFLICT, "Category name already exists")
    return Category(id=cursor.lastrowid, name=payload.name, color=payload.color)


@app.put("/api/categories/{category_id}", response_model=Category)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    current_user: dict = Depends(get_current_user),
) -> Category:
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM categories WHERE id = ? AND user_id = ?",
            (category_id, current_user["id"]),
        ).fetchone()
        if existing is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
        try:
            conn.execute(
                "UPDATE categories SET name = ?, color = ? WHERE id = ?",
                (payload.name, payload.color, category_id),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status.HTTP_409_CONFLICT, "Category name already exists")
    return Category(id=category_id, name=payload.name, color=payload.color)


@app.delete("/api/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int, current_user: dict = Depends(get_current_user)
) -> None:
    with get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM categories WHERE id = ? AND user_id = ?",
            (category_id, current_user["id"]),
        )
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")


# ---------------- Tags ----------------
@app.get("/api/tags", response_model=list[Tag])
def list_tags(current_user: dict = Depends(get_current_user)) -> list[Tag]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name FROM tags WHERE user_id = ? ORDER BY name",
            (current_user["id"],),
        ).fetchall()
    return [Tag(**dict(r)) for r in rows]


@app.delete("/api/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, current_user: dict = Depends(get_current_user)) -> None:
    with get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM tags WHERE id = ? AND user_id = ?",
            (tag_id, current_user["id"]),
        )
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag not found")


# ---------------- Memos ----------------
def _ensure_tags(conn, user_id: int, tag_names: list[str]) -> list[int]:
    """Insert any missing tags for this user; return all tag ids."""
    ids: list[int] = []
    for raw in tag_names:
        name = raw.strip()
        if not name:
            continue
        row = conn.execute(
            "SELECT id FROM tags WHERE user_id = ? AND name = ?", (user_id, name)
        ).fetchone()
        if row:
            ids.append(row["id"])
        else:
            cursor = conn.execute(
                "INSERT INTO tags (user_id, name) VALUES (?, ?)", (user_id, name)
            )
            ids.append(cursor.lastrowid)
    return ids


def _verify_category(conn, user_id: int, category_id: Optional[int]) -> None:
    if category_id is None:
        return
    row = conn.execute(
        "SELECT id FROM categories WHERE id = ? AND user_id = ?",
        (category_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid category_id")


def _load_memo(conn, memo_id: int, user_id: int) -> Optional[Memo]:
    row = conn.execute(
        """
        SELECT m.id, m.title, m.content, m.category_id,
               c.name AS category_name, c.color AS category_color,
               m.created_at, m.updated_at
        FROM memos m
        LEFT JOIN categories c ON c.id = m.category_id
        WHERE m.id = ? AND m.user_id = ?
        """,
        (memo_id, user_id),
    ).fetchone()
    if row is None:
        return None
    tag_rows = conn.execute(
        """
        SELECT t.name FROM tags t
        JOIN memo_tags mt ON mt.tag_id = t.id
        WHERE mt.memo_id = ?
        ORDER BY t.name
        """,
        (memo_id,),
    ).fetchall()
    return Memo(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        category_id=row["category_id"],
        category_name=row["category_name"],
        category_color=row["category_color"],
        tags=[t["name"] for t in tag_rows],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@app.get("/api/memos", response_model=list[Memo])
def list_memos(
    category_id: Optional[int] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[Memo]:
    sql = [
        "SELECT DISTINCT m.id, m.title, m.content, m.category_id,",
        "       c.name AS category_name, c.color AS category_color,",
        "       m.created_at, m.updated_at",
        "FROM memos m",
        "LEFT JOIN categories c ON c.id = m.category_id",
    ]
    params: list = []
    if tag:
        sql.append("JOIN memo_tags mt ON mt.memo_id = m.id")
        sql.append("JOIN tags t ON t.id = mt.tag_id")
    sql.append("WHERE m.user_id = ?")
    params.append(current_user["id"])
    if category_id is not None:
        sql.append("AND m.category_id = ?")
        params.append(category_id)
    if tag:
        sql.append("AND t.name = ?")
        params.append(tag)
    if q:
        sql.append("AND (m.title LIKE ? OR m.content LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like])
    sql.append("ORDER BY m.updated_at DESC")

    with get_conn() as conn:
        rows = conn.execute("\n".join(sql), params).fetchall()
        memos: list[Memo] = []
        for row in rows:
            tag_rows = conn.execute(
                """
                SELECT t.name FROM tags t
                JOIN memo_tags mt ON mt.tag_id = t.id
                WHERE mt.memo_id = ? ORDER BY t.name
                """,
                (row["id"],),
            ).fetchall()
            memos.append(
                Memo(
                    id=row["id"],
                    title=row["title"],
                    content=row["content"],
                    category_id=row["category_id"],
                    category_name=row["category_name"],
                    category_color=row["category_color"],
                    tags=[t["name"] for t in tag_rows],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            )
    return memos


@app.get("/api/memos/{memo_id}", response_model=Memo)
def get_memo(memo_id: int, current_user: dict = Depends(get_current_user)) -> Memo:
    with get_conn() as conn:
        memo = _load_memo(conn, memo_id, current_user["id"])
    if memo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Memo not found")
    return memo


@app.post("/api/memos", response_model=Memo, status_code=201)
def create_memo(
    payload: MemoCreate, current_user: dict = Depends(get_current_user)
) -> Memo:
    with get_conn() as conn:
        _verify_category(conn, current_user["id"], payload.category_id)
        cursor = conn.execute(
            "INSERT INTO memos (user_id, category_id, title, content) VALUES (?, ?, ?, ?)",
            (current_user["id"], payload.category_id, payload.title, payload.content),
        )
        memo_id = cursor.lastrowid
        tag_ids = _ensure_tags(conn, current_user["id"], payload.tags)
        for tid in tag_ids:
            conn.execute(
                "INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)",
                (memo_id, tid),
            )
        conn.commit()
        memo = _load_memo(conn, memo_id, current_user["id"])
    assert memo is not None
    return memo


@app.put("/api/memos/{memo_id}", response_model=Memo)
def update_memo(
    memo_id: int, payload: MemoUpdate, current_user: dict = Depends(get_current_user)
) -> Memo:
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user["id"]),
        ).fetchone()
        if existing is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Memo not found")
        _verify_category(conn, current_user["id"], payload.category_id)
        conn.execute(
            "UPDATE memos SET title = ?, content = ?, category_id = ?, updated_at = datetime('now') WHERE id = ?",
            (payload.title, payload.content, payload.category_id, memo_id),
        )
        conn.execute("DELETE FROM memo_tags WHERE memo_id = ?", (memo_id,))
        tag_ids = _ensure_tags(conn, current_user["id"], payload.tags)
        for tid in tag_ids:
            conn.execute(
                "INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)",
                (memo_id, tid),
            )
        conn.commit()
        memo = _load_memo(conn, memo_id, current_user["id"])
    assert memo is not None
    return memo


@app.delete("/api/memos/{memo_id}", status_code=204)
def delete_memo(memo_id: int, current_user: dict = Depends(get_current_user)) -> None:
    with get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM memos WHERE id = ? AND user_id = ?",
            (memo_id, current_user["id"]),
        )
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Memo not found")


# ---------------- Static ----------------
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")
