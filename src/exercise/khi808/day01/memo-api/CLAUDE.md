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
│        (UI 구조)         (fetch + JWT 헤더 전송)     │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (JSON)
                       │ Authorization: Bearer <token>
                       ▼
┌─────────────────────────────────────────────────────┐
│                  FastAPI (main.py)                  │
│                                                     │
│  [인증 불필요]                                       │
│  POST /auth/register → 회원가입 (bcrypt 해싱)        │
│  POST /auth/login    → 로그인 → JWT 토큰 반환        │
│                                                     │
│  [JWT 인증 필요 — get_current_user_id()]            │
│  GET    /memos       → 내 메모 목록 (최신순)          │
│  GET    /memos/{id}  → 단건 조회                    │
│  POST   /memos       → 생성                         │
│  PUT    /memos/{id}  → 부분 수정                    │
│  DELETE /memos/{id}  → 삭제                         │
│                                                     │
│  GET  /static/*      → 정적 파일 서빙               │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │            인증 Request 흐름                  │   │
│  │  Bearer 토큰 → jose.jwt.decode()             │   │
│  │  → user_id 추출 → SQL WHERE user_id = ?     │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ sqlite3 (Python 내장)
                       ▼
┌─────────────────────────────────────────────────────┐
│                  memos.db (SQLite)                  │
│                                                     │
│  CREATE TABLE users (                               │
│    id              INTEGER PRIMARY KEY,             │
│    username        TEXT NOT NULL UNIQUE,            │
│    hashed_password TEXT NOT NULL,                   │
│    created_at      TEXT NOT NULL                    │
│  )                                                  │
│                                                     │
│  CREATE TABLE memos (                               │
│    id         INTEGER PRIMARY KEY,                  │
│    user_id    INTEGER NOT NULL REFERENCES users(id),│
│    title      TEXT NOT NULL,                        │
│    content    TEXT NOT NULL,                        │
│    created_at TEXT NOT NULL,                        │
│    updated_at TEXT NOT NULL                         │
│  )                                                  │
└─────────────────────────────────────────────────────┘
```

## JWT 인증 흐름

```
회원가입: POST /auth/register  →  bcrypt.hashpw() → users 테이블 저장
로그인:   POST /auth/login     →  비밀번호 검증 → JWT 발급 (60분 만료)
API 요청: Authorization: Bearer <token>
          → jose.jwt.decode() → sub(user_id) 추출
          → 메모 쿼리에 WHERE user_id = ? 적용 (사용자 격리)
```

## 파일 구조

```
memo-api/
├── main.py          # FastAPI 앱 (인증·라우터·스키마·DB 단일 파일)
├── memos.db         # SQLite DB (앱 최초 실행 시 자동 생성)
├── pyproject.toml   # uv 의존성
├── uv.lock
├── .gitignore       # memos.db 제외
└── static/
    ├── index.html   # 로그인/회원가입 + 메모 앱 UI
    ├── style.css    # 다크모드 CSS 변수 기반 스타일
    └── app.js       # JWT 저장·전송·인증 상태 관리·메모 CRUD
```

## 주요 설계 결정

- **JWT**: `python-jose` + HS256, 토큰 만료 60분, `sub` 클레임에 `user_id` 저장
- **비밀번호 해싱**: `passlib` 호환 문제로 `bcrypt` 직접 사용 (`bcrypt.hashpw` / `bcrypt.checkpw`)
- **사용자 격리**: 모든 메모 쿼리에 `WHERE user_id = ?` 조건 적용 — 타인 메모 접근 불가
- **토큰 저장**: 프론트엔드 `localStorage` (`memo_token` 키) — 새로고침 후에도 로그인 유지
- **단일 파일 서버**: ORM 없이 Python 내장 `sqlite3` 직접 사용
- **`row_factory = sqlite3.Row`**: `dict(row)` 변환으로 Pydantic 스키마에 바로 전달
- **정적 파일**: `app.mount`는 반드시 모든 라우터 등록 **이후**에 위치해야 함

## Git Workflow

```bash
git pull origin main   # merge (rebase 금지)
git push origin main
```
