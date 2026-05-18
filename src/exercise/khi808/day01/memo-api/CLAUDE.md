# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행 / 종료

```bash
# 실행 (hot-reload 포함)
cd src/exercise/khi808/day01/memo-api
source $HOME/.local/bin/env
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 종료
kill $(lsof -ti:8000)
```

- 웹 UI → `http://localhost:8000`
- Swagger 문서 → `http://localhost:8000/docs`

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│                                                     │
│   static/index.html  ←→  static/app.js             │
│        (UI 구조)              (fetch API 호출)       │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (JSON)
                       ▼
┌─────────────────────────────────────────────────────┐
│                  FastAPI (main.py)                  │
│                                                     │
│  GET  /              → redirect /static/index.html  │
│  GET  /memos         → 목록 조회 (최신순)            │
│  GET  /memos/{id}    → 단건 조회                    │
│  POST /memos         → 생성                         │
│  PUT  /memos/{id}    → 부분 수정                    │
│  DELETE /memos/{id}  → 삭제                         │
│  GET  /static/*      → 정적 파일 서빙               │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │            Request 흐름                      │   │
│  │  Route → get_conn() → sqlite3.Connection    │   │
│  │       → SQL 실행 → dict(row) → Response     │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ sqlite3 (Python 내장)
                       ▼
┌─────────────────────────────────────────────────────┐
│                  memos.db (SQLite)                  │
│                                                     │
│  CREATE TABLE memos (                               │
│    id         INTEGER PRIMARY KEY AUTOINCREMENT,    │
│    title      TEXT NOT NULL,                        │
│    content    TEXT NOT NULL,                        │
│    created_at TEXT NOT NULL,                        │
│    updated_at TEXT NOT NULL                         │
│  )                                                  │
└─────────────────────────────────────────────────────┘
```

## 파일 구조

```
memo-api/
├── main.py          # FastAPI 앱 (라우터·스키마·DB 연결 단일 파일)
├── memos.db         # SQLite DB (앱 최초 실행 시 자동 생성)
├── pyproject.toml   # uv 의존성 (fastapi, uvicorn, aiofiles)
├── uv.lock
├── .gitignore       # memos.db 제외
└── static/
    ├── index.html   # 앱 셸 (레이아웃·DOM 구조)
    ├── style.css    # 다크모드 CSS 변수 기반 스타일
    └── app.js       # API 통신·UI 렌더링·이벤트 처리
```

## 주요 설계 결정

- **단일 파일 서버**: ORM 없이 Python 내장 `sqlite3` 직접 사용 — 의존성 최소화
- **연결 방식**: 요청마다 `get_conn()` 으로 커넥션 생성 후 `finally`에서 `close()`
- **`row_factory = sqlite3.Row`**: `dict(row)` 변환으로 Pydantic 스키마에 바로 전달
- **부분 수정**: `MemoUpdate` 필드는 모두 `Optional` — `exclude_unset=True`로 전달된 필드만 UPDATE
- **정적 파일**: `app.mount`는 반드시 모든 라우터 등록 **이후**에 위치해야 함

## Git Workflow

```bash
git pull origin main   # merge (rebase 금지)
git push origin main
```
