# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

FastAPI 기반 메모장 앱. 백엔드 CRUD API와 HTML/CSS/JS 프론트엔드로 구성된다. 데이터는 SQLite(`memos.db`)에 영구 저장되며, 서버를 재시작해도 유지된다.

## 서버 실행

```bash
~/.local/bin/uvicorn main:app --host 0.0.0.0 --port 8001
```

개발 중 코드 변경 자동 반영:

```bash
~/.local/bin/uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

| URL | 설명 |
|-----|------|
| `http://localhost:8001` | 프론트엔드 UI |
| `http://localhost:8001/docs` | Swagger UI |
| `http://localhost:8001/redoc` | ReDoc |

## 파일 구성

| 파일 | 역할 |
|------|------|
| `main.py` | FastAPI 앱 — CRUD API + 정적 파일 서빙 |
| `memos.db` | SQLite 데이터베이스 파일 (자동 생성) |
| `index.html` | 프론트엔드 HTML 구조 |
| `style.css` | 2단 그리드 레이아웃, 카드 UI, 반응형 스타일 |
| `app.js` | Fetch API로 CRUD 호출, 카드 렌더링·인라인 편집 |

## 백엔드 구조 (main.py)

- **DB**: `sqlite3` 표준 라이브러리 사용. 모듈 로드 시 `init_db()`로 `memos` 테이블 자동 생성
- **커넥션 관리**: `get_db()` 의존성 — 요청마다 커넥션 생성 후 `finally`에서 닫음. `row_factory = sqlite3.Row`로 행을 딕셔너리처럼 접근
- **ID 발급**: SQLite `AUTOINCREMENT`, `cursor.lastrowid`로 생성된 ID 조회
- **정적 파일**: `GET /` → `index.html` 반환, `/static/*` → 현재 디렉터리 마운트
- **Pydantic 모델 3개**
  - `MemoCreate` — POST 요청 바디 (`title`, `content` 필수)
  - `MemoUpdate` — PUT 요청 바디 (`title`, `content` 모두 Optional, 부분 수정 가능)
  - `MemoResponse` — 응답 스키마 (`id`, `title`, `content`)

## API 엔드포인트

| 메서드 | 경로 | 동작 | 응답 코드 |
|--------|------|------|-----------|
| GET | `/memos` | 전체 목록 | 200 |
| GET | `/memos/{id}` | 단건 조회 | 200 / 404 |
| POST | `/memos` | 생성 | 201 |
| PUT | `/memos/{id}` | 부분 수정 | 200 / 404 |
| DELETE | `/memos/{id}` | 삭제 | 204 / 404 |

## 프론트엔드 구조 (app.js)

- `fetchMemos / createMemo / updateMemo / deleteMemo` — Fetch API 래퍼
- `renderMemos(memos)` — 전체 목록 재렌더링 (항상 전체를 다시 그린다)
- `buildCard(memo)` — 일반 카드 DOM 생성 (수정·삭제 버튼 포함)
- `switchToEditMode(card, memo)` — 카드를 인라인 편집 폼으로 전환
- XSS 방지를 위해 모든 사용자 입력은 `escapeHtml()`로 처리 후 innerHTML에 삽입

## 의존성

`sqlite3`는 Python 표준 라이브러리에 포함되어 있어 별도 설치가 필요 없다.

pip가 없는 경우 bootstrap 스크립트로 먼저 설치한다:

```bash
curl -sS https://bootstrap.pypa.io/get-pip.py | python3
```

이후 fastapi와 uvicorn 설치:

```bash
~/.local/bin/pip install fastapi uvicorn
```
