# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git 정책

- 원격 변경사항을 가져올 때 rebase 대신 merge 사용
- 변경사항 확인 및 커밋/푸시는 항상 현재 폴더(`src/exercise/hyunhong93/day01/`) 기준으로 수행

```bash
# 현재 폴더 파일만 스테이징
git add src/exercise/hyunhong93/day01/<파일명>

# 커밋 후 merge 방식으로 pull & push
git commit -m "메시지"
git pull --no-rebase origin main
git push origin main
```

## 서버 실행

### FastAPI 메모 앱 (`api/`)

```bash
cd api
python3 -m uvicorn main:app --reload --port 8000
```

- UI: `http://localhost:8000`
- API 문서(Swagger): `http://localhost:8000/docs`
- 서버 종료: `kill $(lsof -ti:8000)`

### 마크다운 에디터 (외부 CSS/JS 파일 분리 구조)

```bash
python3 -m http.server 8080
# http://localhost:8080/markdown-editor.html
```

## 테스트 실행

```bash
# fibonacci 테스트 전체
cd fibonacci && python3 -m pytest test_fibonacci.py

# 단일 테스트
python3 -m pytest test_fibonacci.py::TestFibonacci::test_fibonacci
```

## 프로젝트 구조

### FastAPI 메모 앱 (`api/`)

- `main.py` — FastAPI 앱. `/api/memos` CRUD 엔드포인트 + `/static` 마운트 + `/`에서 `index.html` 서빙
- `static/index.html` — 단일 파일 프론트엔드. `fetch('/api/memos')`로 백엔드 호출
- `memos.db` — SQLite DB (서버 최초 기동 시 자동 생성, git 제외)

`get_db()`는 `contextmanager`로 연결을 열고 commit/close를 보장하는 헬퍼.  
`startup` 이벤트에서 `init_db()`를 호출해 테이블을 자동 생성.

### 마크다운 에디터 (`markdown-editor.*`)

- `markdown-editor.html` — marked.js CDN 로드
- `markdown-editor.css` — 다크/라이트 테마 (`body[data-theme="light"]`로 분기)
- `markdown-editor.js` — 렌더링, 툴바 액션, localStorage 자동저장(500ms 디바운스), 테마 토글

**localStorage 키:** `md-editor-content`, `md-editor-theme`

### fibonacci (`fibonacci/`)

- `fibonacci.py` — 반복문 기반 구현 (F(0)=0, F(1)=1), 음수 입력 시 `ValueError`
- `test_fibonacci.py` — unittest 기반 테스트
