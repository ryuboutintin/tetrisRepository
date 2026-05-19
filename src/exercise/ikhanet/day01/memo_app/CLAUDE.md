# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행

```bash
# 의존성 설치 (최초 1회)
python3 -m pip install fastapi "uvicorn[standard]" sqlalchemy

# 서버 실행 (memo_app/ 디렉터리에서)
python3 -m uvicorn main:app --reload --port 8000
```

- UI: http://localhost:8000
- API 문서: http://localhost:8000/docs
- `memos.db`는 첫 실행 시 자동 생성됨

## 아키텍처

요청 흐름: 브라우저 → FastAPI(`main.py`) → SQLAlchemy Session → SQLite(`memos.db`)

**백엔드 레이어**

| 파일 | 역할 |
|------|------|
| `database.py` | SQLite 엔진, `SessionLocal`, `get_db()` 의존성 |
| `models.py` | `Memo` ORM 모델 (`memos` 테이블) |
| `schemas.py` | Pydantic 스키마 — `MemoCreate`, `MemoUpdate`, `MemoResponse` |
| `main.py` | FastAPI 앱, CRUD 5개 엔드포인트, `static/` 마운트 |

**프론트엔드** (`static/`)

- 단일 페이지 앱(SPA). 페이지 리로드 없이 `fetch`로 API 호출.
- `memoData` (`Map`) 가 렌더링된 메모 객체를 id 키로 캐싱 — 수정 폼 진입 시 재조회 없이 사용.
- `escHtml()`로 XSS 방지 후 innerHTML에 삽입.

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/memos` | 전체 목록 (최신순) |
| POST | `/memos` | 생성 — `{title, content?, tags?}` |
| GET | `/memos/{id}` | 단건 조회 |
| PUT | `/memos/{id}` | 수정 — 변경 필드만 전송 가능, `updated_at` 자동 갱신 |
| DELETE | `/memos/{id}` | 삭제 |

## 데이터 모델

```
Memo: id | title (필수) | content | tags | created_at | updated_at
```

- `tags`: 콤마 구분 문자열 (`"work,idea,todo"`)
- `updated_at`: `main.py`의 PUT 핸들러에서 `datetime.now()`로 명시적 갱신
