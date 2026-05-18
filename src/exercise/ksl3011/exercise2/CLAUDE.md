# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Two servers must run simultaneously:

```bash
# Terminal 1 — FastAPI backend (port 8000)
cd src/exercise/ksl3011/exercise2
python3 -m uvicorn main:app --port 8000 --reload

# Terminal 2 — Static frontend (port 8080)
cd src/exercise/ksl3011/exercise2
python3 -m http.server 8080
```

Open `http://localhost:8080/index.html` in the browser.

**Required packages** (install once):
```bash
python3 -m pip install fastapi uvicorn python-multipart
```

## Architecture

### Backend (`main.py` → `storage.py`)

`main.py` is a thin FastAPI router — it handles HTTP concerns (request parsing, status codes, CORS) and delegates all persistence to `storage.py`. No business logic lives in the route handlers; they call one storage function and return the result.

`storage.py` opens a fresh SQLite connection per function call (no shared connection object). Every write operation that touches `memos` also updates `memos_fts` in the same transaction to keep the FTS index in sync.

**SQLite schema** (`data/memos.db`):
```
memos      — id, title, content, tags (JSON string), created_at, updated_at,
              is_deleted (0/1), deleted_at
memos_fts  — FTS5 virtual table, tokenize='trigram', rowid = memos.id
```

`tags` is stored as a JSON array string (`'["업무","개인"]'`) because SQLite has no array type. `json_each()` is used for tag filtering queries.

**Soft delete flow**: `DELETE /memos/{id}` sets `is_deleted=1` and removes the FTS entry. `POST /memos/{id}/restore` reverses both. `DELETE /memos/{id}/permanent` actually removes the row.

**Route ordering matters**: fixed paths (`/memos/tags`, `/memos/trash`, `/memos/export`, `/memos/import`) must be declared before `/memos/{memo_id}` in `main.py` so FastAPI doesn't capture the literal string as an integer parameter.

### Frontend (`index.html` + `style.css` + `app.js`)

Vanilla JS, no framework. State lives in module-level variables in `app.js`:
- `allMemos` — all non-deleted memos (source of truth for client-side filtering)
- `trashMemos` — deleted memos, populated only when trash view is active
- `currentId` / `isNew` — which memo is open in the editor
- `activeTag` / `searchInput.value` — filter state applied in `getFilteredMemos()`

**Data flow**: `loadMemos()` fetches all memos once and populates `allMemos`. Search and tag filtering are done client-side inside `getFilteredMemos()` without additional API calls. The server-side `?q=` FTS5 endpoint exists for external API consumers but the frontend does not use it for the search box.

**Auto-save**: input events on title/content/tags schedule `doSave(isAuto=true)` via a 1500 ms debounce timer. The same `doSave()` function handles both manual (form submit) and auto saves.

**Theming**: CSS custom properties under `:root` and `[data-theme="dark"]`. Theme preference is stored in `localStorage` under `memo-theme`.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/memos` | List all (supports `?q=` FTS search, `?tag=` filter) |
| GET | `/memos/tags` | All unique tags across active memos |
| GET | `/memos/trash` | Soft-deleted memos |
| GET | `/memos/export` | Download all memos as JSON file |
| GET | `/memos/{id}` | Single memo |
| POST | `/memos` | Create |
| PUT | `/memos/{id}` | Partial update (only non-null fields applied) |
| DELETE | `/memos/{id}` | Soft delete → trash |
| POST | `/memos/{id}/restore` | Restore from trash |
| DELETE | `/memos/{id}/permanent` | Permanent delete |
| POST | `/memos/import` | Upload JSON array file to import |

**Validation** (Pydantic): `content` 1–50,000 chars, `title` max 200 chars, `tags` max 10 items.
