# CLAUDE.md

## 프로젝트 구조

```
memo/
├── main.py          # FastAPI 앱 (라우터 + SQLAlchemy 모델 + Pydantic 스키마)
├── index.html       # 프론트엔드 UI (vanilla JS, 단일 파일)
├── requirements.txt # 의존 패키지 목록
└── .venv/           # 가상환경 (git 제외)
```

> `memo.db`, `__pycache__/` 는 `.gitignore`(상위 `sjpark/`)로 제외됨.

## 실행 방법

```bash
# 최초 1회: 가상환경 생성 및 패키지 설치
uv venv .venv
uv pip install --python .venv/bin/python fastapi "uvicorn[standard]" sqlalchemy

# 서버 실행
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8888 --reload
```

브라우저에서 `http://localhost:8888/` 접속.  
WSL 환경이면 Windows 브라우저에서도 동일 URL로 접속 가능.

## 아키텍처

### 백엔드 (`main.py`)

- **FastAPI** 단일 파일 구성 — 모델, 스키마, 라우터를 분리 없이 한 파일에 관리
- **SQLite** (`memo.db`) — SQLAlchemy ORM, `check_same_thread=False`로 단일 스레드 제약 해제
- **DB 모델** (`MemoModel`): `id`, `title`, `content`, `created_at`, `updated_at`
- **Pydantic 스키마**: `MemoCreate` / `MemoUpdate`(부분 업데이트) / `MemoResponse`
- `/` 라우트가 `index.html`을 `FileResponse`로 서빙 → 별도 정적 파일 서버 불필요

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/memos` | 전체 목록 (updated_at 내림차순) |
| GET | `/memos/{id}` | 단건 조회 |
| POST | `/memos` | 생성 (201) |
| PUT | `/memos/{id}` | 수정 (부분 업데이트 가능) |
| DELETE | `/memos/{id}` | 삭제 (204) |

### 프론트엔드 (`index.html`)

- **뷰 모드 / 편집 모드 분리**: 메모 클릭 시 읽기 전용, `수정` 버튼 클릭 시에만 편집 가능
- **새 메모**: `+ 새 메모` 버튼 → 바로 편집 모드 진입
- **저장 후**: 자동으로 뷰 모드로 전환
- **취소**: 기존 메모면 뷰 모드 복귀, 새 메모 작성 중이면 초기 화면
- API 호출은 `fetch`로 직접 처리, 외부 라이브러리 없음
- 디자인 테마: Catppuccin Mocha (`--bg: #1e1e2e`)

## Git 규칙

- `src/exercise/sjpark/` 하위 파일만 수정
- commit/push 전 반드시 `git pull --no-rebase origin main` 선행
- 스테이징은 명시적 경로: `git add src/exercise/sjpark/...`
