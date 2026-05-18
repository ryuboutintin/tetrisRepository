import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional

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
                updated_at TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT
            )
        """)
        for col, definition in [
            ("is_deleted", "INTEGER NOT NULL DEFAULT 0"),
            ("deleted_at", "TEXT"),
        ]:
            try:
                conn.execute(f"ALTER TABLE memos ADD COLUMN {col} {definition}")
            except sqlite3.OperationalError:
                pass

        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS memos_fts USING fts5(
                title, content, tags,
                tokenize='trigram'
            )
        """)


_init()


def _to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    d["tags"] = json.loads(d["tags"])
    d["is_deleted"] = bool(d["is_deleted"])
    return d


def _fts_upsert(conn: sqlite3.Connection, memo_id: int, title: Optional[str], content: str, tags_json: str) -> None:
    conn.execute("DELETE FROM memos_fts WHERE rowid = ?", (memo_id,))
    conn.execute(
        "INSERT INTO memos_fts(rowid, title, content, tags) VALUES (?, ?, ?, ?)",
        (memo_id, title or "", content, tags_json),
    )


def _fts_remove(conn: sqlite3.Connection, memo_id: int) -> None:
    conn.execute("DELETE FROM memos_fts WHERE rowid = ?", (memo_id,))


# ── 조회 ─────────────────────────────────────────────────────────────────────

def get_all(q: Optional[str] = None, tag: Optional[str] = None) -> List[Dict[str, Any]]:
    with _connect() as conn:
        if q:
            rows = conn.execute("""
                SELECT m.* FROM memos m
                WHERE m.id IN (SELECT rowid FROM memos_fts WHERE memos_fts MATCH ?)
                  AND m.is_deleted = 0
                ORDER BY m.updated_at DESC
            """, (q,)).fetchall()
        elif tag:
            rows = conn.execute("""
                SELECT DISTINCT m.* FROM memos m, json_each(m.tags) t
                WHERE t.value = ? AND m.is_deleted = 0
                ORDER BY m.updated_at DESC
            """, (tag,)).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM memos WHERE is_deleted = 0 ORDER BY updated_at DESC"
            ).fetchall()
    return [_to_dict(r) for r in rows]


def get_by_id(memo_id: int) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM memos WHERE id = ?", (memo_id,)).fetchone()
    return _to_dict(row) if row else None


def get_all_tags() -> List[str]:
    with _connect() as conn:
        rows = conn.execute("""
            SELECT DISTINCT t.value FROM memos m, json_each(m.tags) t
            WHERE m.is_deleted = 0
            ORDER BY t.value
        """).fetchall()
    return [r[0] for r in rows]


def get_trash() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM memos WHERE is_deleted = 1 ORDER BY deleted_at DESC"
        ).fetchall()
    return [_to_dict(r) for r in rows]


# ── 쓰기 ─────────────────────────────────────────────────────────────────────

def create(data: Dict[str, Any]) -> Dict[str, Any]:
    tags_json = json.dumps(data.get("tags", []), ensure_ascii=False)
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO memos (title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (data.get("title"), data["content"], tags_json, data["created_at"], data["updated_at"]),
        )
        new_id = cur.lastrowid
        _fts_upsert(conn, new_id, data.get("title"), data["content"], tags_json)
    return get_by_id(new_id)


def update(memo_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    current = get_by_id(memo_id)
    if not current:
        return None
    merged = {**current, **data}
    tags_json = json.dumps(merged.get("tags", []), ensure_ascii=False)
    with _connect() as conn:
        conn.execute(
            "UPDATE memos SET title=?, content=?, tags=?, updated_at=? WHERE id=?",
            (merged.get("title"), merged["content"], tags_json, merged["updated_at"], memo_id),
        )
        _fts_upsert(conn, memo_id, merged.get("title"), merged["content"], tags_json)
    return get_by_id(memo_id)


def delete(memo_id: int) -> bool:
    """소프트 삭제 — 휴지통으로 이동."""
    if not get_by_id(memo_id):
        return False
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            "UPDATE memos SET is_deleted=1, deleted_at=? WHERE id=?",
            (now, memo_id),
        )
        _fts_remove(conn, memo_id)
    return True


def restore(memo_id: int) -> Optional[Dict[str, Any]]:
    memo = get_by_id(memo_id)
    if not memo:
        return None
    with _connect() as conn:
        conn.execute(
            "UPDATE memos SET is_deleted=0, deleted_at=NULL WHERE id=?",
            (memo_id,),
        )
        tags_json = json.dumps(memo.get("tags", []), ensure_ascii=False)
        _fts_upsert(conn, memo_id, memo.get("title"), memo["content"], tags_json)
    return get_by_id(memo_id)


def hard_delete(memo_id: int) -> bool:
    """영구 삭제."""
    if not get_by_id(memo_id):
        return False
    with _connect() as conn:
        _fts_remove(conn, memo_id)
        conn.execute("DELETE FROM memos WHERE id=?", (memo_id,))
    return True


# ── 내보내기 / 가져오기 ──────────────────────────────────────────────────────

def export_all() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM memos WHERE is_deleted = 0 ORDER BY created_at"
        ).fetchall()
    return [_to_dict(r) for r in rows]


def import_memos(items: List[Dict[str, Any]]) -> int:
    now = datetime.now(timezone.utc).isoformat()
    count = 0
    with _connect() as conn:
        for m in items:
            if not m.get("content"):
                continue
            tags_json = json.dumps(m.get("tags", []), ensure_ascii=False)
            cur = conn.execute(
                "INSERT INTO memos (title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (
                    m.get("title"),
                    m["content"],
                    tags_json,
                    m.get("created_at", now),
                    m.get("updated_at", now),
                ),
            )
            _fts_upsert(conn, cur.lastrowid, m.get("title"), m["content"], tags_json)
            count += 1
    return count
