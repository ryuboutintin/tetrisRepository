# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

바이브코딩 2026 2nd 교육 과정의 실습 저장소입니다. GitHub 계정 `sofansil`(hoho12)의 실습 작업물은 `src/exercise/hoho12/` 아래에 위치합니다.

- Remote: `git@github.com:weable-kosa/kosa-vibecoding-2026-2nd.git`
- 공용 저장소이므로 `src/exercise/hoho12/` 밖의 파일은 수정하지 않습니다.

## Running code

```bash
# Python 스크립트 실행
python3 src/exercise/hoho12/day01/Fibonacci.py 20
python3 src/exercise/hoho12/day01/pi.py 100000
python3 src/exercise/hoho12/day01/todo.py

# 메모 앱 서버 실행 (memo-app 디렉토리에서 실행해야 함)
cd src/exercise/hoho12/day01/memo-app
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# 접속: http://localhost:8000
# API 문서: http://localhost:8000/docs

# 마크다운 에디터는 브라우저로 직접 열어 확인 (빌드 도구 없음)
# ! explorer.exe "C:\work\kosa-vibecoding-2026-2nd\src\exercise\hoho12\day01\markdown-editor\index.html"
```

의존성 설치:
```bash
python3 -m pip install fastapi "uvicorn[standard]" httpx
```

## Architecture

### day01/

| 경로 | 설명 |
|------|------|
| `memo-app/` | FastAPI + SQLite 메모장 앱. 프론트엔드 포함. |
| `markdown-editor/` | 순수 HTML/CSS/JS 마크다운 에디터. CDN으로 marked.js(v5+) 로드. |
| `Fibonacci.py` | 피보나치 수열 생성 (`sys.argv[1]`로 개수 지정) |
| `pi.py` | Nilakantha 급수로 원주율 근사 계산 |
| `todo.py` | 인메모리 TODO 리스트 (add/complete/delete/show) |

### memo-app 구조

- `main.py` — FastAPI 앱. SQLite CRUD + `GET /` 에서 `static/index.html` 서빙
- `static/index.html` — 프론트엔드 (사이드바 목록 + 에디터 영역, 단일 파일)
- `memos.db` — SQLite DB 파일 (`.gitignore` 처리됨, 서버 첫 실행 시 자동 생성)

**memo-app 핵심 패턴:**
- DB 연결은 `@contextmanager get_db()`로 요청마다 열고 닫음 (커넥션 풀 없음)
- `app.on_event("startup")`에서 `init_db()` 호출해 테이블 자동 생성
- `uvicorn`은 **memo-app 디렉토리 안에서** 실행해야 `static/`, `memos.db` 경로가 올바르게 잡힘
- 프론트엔드는 800ms debounce 자동저장 + `Ctrl+S` 즉시 저장

**REST API:**

| Method | Path | 설명 |
|--------|------|------|
| GET | `/memos` | 전체 목록 (updated_at 내림차순) |
| POST | `/memos` | 생성 (201) |
| GET | `/memos/{id}` | 단건 조회 |
| PUT | `/memos/{id}` | 부분 수정 (title/content 선택적) |
| DELETE | `/memos/{id}` | 삭제 (204) |

### markdown-editor 구조

- `index.html` — 레이아웃 (툴바, 편집 pane, 미리보기 pane)
- `style.css` — 다크테마, 구분선 드래그, 반응형(640px 이하 상하 전환)
- `app.js` — 렌더링, localStorage 자동저장(800ms debounce), 툴바 액션, 단축키

**marked.js 사용 시 주의**: `marked.setOptions()`은 v5+에서 제거됨. 옵션은 `marked.parse(text, { breaks: true, gfm: true })` 형태로 직접 전달해야 합니다.

**단축키 (keyboard event)**: `e.key`는 Shift 조합 시 대문자를 반환하므로 반드시 `e.key.toLowerCase()`로 비교해야 합니다.

## Git workflow

공용 저장소 특성상 push 전에 다른 사람 커밋이 먼저 올라가는 경우가 많습니다.

```bash
git add src/exercise/hoho12/<파일>   # 경로 직접 지정 (git add . 금지)
git commit -m "메시지"
git pull --rebase origin main        # rejected 시 rebase로 해결
git push origin main
```

## Environment notes

- WSL2(Ubuntu) 환경에서 작업합니다.
- `pip3` 명령이 없으면 `python3 -m pip`을 사용합니다.
- Windows 브라우저를 열 때는 `explorer.exe` 경로를 Windows 형식(`C:\...`)으로 전달합니다. `cmd.exe`, `powershell.exe`는 WSL에서 바이너리 실행 오류가 발생합니다.
- 개발 중 브라우저 캐시 문제가 생기면 시크릿 창을 사용하거나 DevTools → Network → "Disable cache"를 켠 채로 새로고침합니다.
