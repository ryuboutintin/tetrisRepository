import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any

DB_FILE = Path(__file__).parent / "data" / "memos.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn


def _init() -> None:
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memos (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT,
                content    TEXT NOT NULL,
                tags       TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)


_init()


def _to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    d["tags"] = json.loads(d["tags"])
    return d


def get_all() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM memos ORDER BY updated_at DESC"
        ).fetchall()
    return [_to_dict(r) for r in rows]


def get_by_id(memo_id: int) -> Dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM memos WHERE id = ?", (memo_id,)
        ).fetchone()
    return _to_dict(row) if row else None


def create(data: Dict[str, Any]) -> Dict[str, Any]:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO memos (title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (
                data.get("title"),
                data["content"],
                json.dumps(data.get("tags", []), ensure_ascii=False),
                data["created_at"],
                data["updated_at"],
            ),
        )
        new_id = cur.lastrowid
    return get_by_id(new_id)


def update(memo_id: int, data: Dict[str, Any]) -> Dict[str, Any] | None:
    current = get_by_id(memo_id)
    if not current:
        return None
    merged = {**current, **data}
    with _connect() as conn:
        conn.execute(
            "UPDATE memos SET title=?, content=?, tags=?, updated_at=? WHERE id=?",
            (
                merged.get("title"),
                merged["content"],
                json.dumps(merged.get("tags", []), ensure_ascii=False),
                merged["updated_at"],
                memo_id,
            ),
        )
    return get_by_id(memo_id)


def delete(memo_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
    return cur.rowcount > 0
