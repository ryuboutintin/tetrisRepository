import json
from pathlib import Path
from typing import List, Dict, Any

DATA_FILE = Path(__file__).parent / "data" / "memos.json"


def _read() -> List[Dict[str, Any]]:
    if not DATA_FILE.exists() or DATA_FILE.stat().st_size == 0:
        return []
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def _write(memos: List[Dict[str, Any]]) -> None:
    DATA_FILE.write_text(json.dumps(memos, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def get_all() -> List[Dict[str, Any]]:
    return _read()


def get_by_id(memo_id: int) -> Dict[str, Any] | None:
    return next((m for m in _read() if m["id"] == memo_id), None)


def create(data: Dict[str, Any]) -> Dict[str, Any]:
    memos = _read()
    new_id = max((m["id"] for m in memos), default=0) + 1
    data["id"] = new_id
    memos.append(data)
    _write(memos)
    return data


def update(memo_id: int, data: Dict[str, Any]) -> Dict[str, Any] | None:
    memos = _read()
    for i, m in enumerate(memos):
        if m["id"] == memo_id:
            memos[i].update(data)
            _write(memos)
            return memos[i]
    return None


def delete(memo_id: int) -> bool:
    memos = _read()
    filtered = [m for m in memos if m["id"] != memo_id]
    if len(filtered) == len(memos):
        return False
    _write(filtered)
    return True
