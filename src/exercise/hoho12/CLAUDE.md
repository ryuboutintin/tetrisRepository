# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

바이브코딩 2026 2nd 교육 과정의 실습 저장소입니다. GitHub 계정 `sofansil`(hoho12)의 실습 작업물은 `src/exercise/hoho12/` 아래에 위치합니다.

- Remote: `git@github.com:weable-kosa/kosa-vibecoding-2026-2nd.git`
- 공용 저장소이므로 `src/exercise/hoho12/` 밖의 파일은 수정하지 않습니다.

## Running code

```bash
# 메모 앱 서버 실행 (memo-app 디렉토리 안에서 실행해야 함)
cd src/exercise/hoho12/day01/memo-app
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
# 접속: http://localhost:8000   API 문서: http://localhost:8000/docs

# Python 스크립트
python3 src/exercise/hoho12/day01/Fibonacci.py 20
python3 src/exercise/hoho12/day01/pi.py 100000
python3 src/exercise/hoho12/day01/todo.py

# 마크다운 에디터 (브라우저로 직접 열기, WSL)
# ! explorer.exe "C:\work\kosa-vibecoding-2026-2nd\src\exercise\hoho12\day01\markdown-editor\index.html"
```

의존성 설치:
```bash
python3 -m pip install fastapi "uvicorn[standard]" "python-jose[cryptography]" "passlib[bcrypt]" python-multipart httpx
```

## Architecture

### day01/

| 경로 | 설명 |
|------|------|
| `memo-app/` | FastAPI + SQLite 메모장 앱 (JWT 인증, 태그, 프론트엔드 포함) |
| `markdown-editor/` | 순수 HTML/CSS/JS 마크다운 에디터. CDN으로 marked.js(v5+) 로드. |
| `Fibonacci.py` | 피보나치 수열 생성 (`sys.argv[1]`로 개수 지정) |
| `pi.py` | Nilakantha 급수로 원주율 근사 계산 |
| `todo.py` | 인메모리 TODO 리스트 (add/complete/delete/show) |

### memo-app 구조

- `main.py` — FastAPI 앱 (단일 파일). 인증 + 메모 CRUD + 태그 + 정적 파일 서빙
- `static/index.html` — 프론트엔드 단일 파일. 로그인/회원가입 오버레이 + 메모 에디터
- `memos.db` — SQLite DB (`.gitignore` 처리, 서버 첫 실행 시 자동 생성)

**DB 스키마 (4개 테이블):**
```
users      — id, username, password_hash, created_at
memos      — id, user_id(FK), title, content, created_at, updated_at
tags       — id, user_id(FK), name  (user_id + name UNIQUE)
memo_tags  — memo_id(FK), tag_id(FK)  (다대다 연결, ON DELETE CASCADE)
```

**memo-app 핵심 패턴:**
- DB 연결: `@contextmanager get_db()` — 요청마다 열고 닫음, `PRAGMA foreign_keys = ON` 적용
- `app.on_event("startup")`에서 `init_db()` 호출 → 테이블 자동 생성
- `uvicorn`은 반드시 **memo-app 디렉토리 안에서** 실행 (`static/`, `memos.db` 상대 경로 의존)
- 스키마 변경 시 기존 `memos.db`를 삭제해야 함 (마이그레이션 없음)

**REST API:**

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/auth/register` | 불필요 | 회원가입 → JWT 반환 |
| POST | `/auth/login` | 불필요 | 로그인 → JWT 반환 (form data) |
| GET | `/memos` | Bearer | 내 메모 목록 (태그 포함) |
| POST | `/memos` | Bearer | 생성 (tags: list 포함) |
| GET | `/memos/{id}` | Bearer | 단건 조회 |
| PUT | `/memos/{id}` | Bearer | 부분 수정 (tags 포함) |
| DELETE | `/memos/{id}` | Bearer | 삭제 (204) |
| GET | `/tags` | Bearer | 내 태그 전체 목록 |

**JWT 패턴:**
- `python-jose`로 HS256 토큰 생성, `passlib[bcrypt]`로 비밀번호 해시
- `OAuth2PasswordBearer`로 헤더에서 토큰 추출 → `get_current_user()` dependency
- 프론트엔드는 토큰을 `localStorage`에 저장, 모든 API 요청에 `Authorization: Bearer <token>` 헤더 포함
- 401 응답 수신 시 자동 로그아웃

**태그 패턴:**
- `set_memo_tags(conn, memo_id, user_id, tag_names)` — 기존 태그 전부 삭제 후 재삽입
- 태그 이름은 소문자로 정규화, 같은 user 내 중복 없음 (`INSERT OR IGNORE`)
- 프론트엔드에서 Enter/콤마로 태그 추가, Backspace로 마지막 태그 삭제

### markdown-editor 구조

- `index.html` — 레이아웃 (툴바, 편집 pane, 미리보기 pane)
- `style.css` — 다크테마, 구분선 드래그, 반응형(640px 이하 상하 전환)
- `app.js` — 렌더링, localStorage 자동저장(800ms debounce), 툴바 액션, 단축키

**marked.js 주의**: `marked.setOptions()`은 v5+에서 제거됨. `marked.parse(text, { breaks: true, gfm: true })`로 직접 전달해야 합니다.

**단축키 주의**: `e.key`는 Shift 조합 시 대문자를 반환 → 반드시 `e.key.toLowerCase()`로 비교해야 합니다.

## Git workflow

공용 저장소 특성상 push 전에 다른 사람 커밋이 먼저 올라가는 경우가 많습니다.

```bash
git add src/exercise/hoho12/<파일>   # 경로 직접 지정 (git add . 금지)
git commit -m "메시지"
git pull --rebase origin main        # rejected 시 rebase로 해결
git push origin main
```

`pull --rebase`를 두 번 반복해야 하는 경우도 있습니다 (활발한 공용 저장소 특성).

## Environment notes

- WSL2(Ubuntu) 환경. `pip3`가 없으면 `python3 -m pip` 사용.
- Windows 브라우저: `explorer.exe`에 Windows 경로(`C:\...`)로 전달. `cmd.exe`/`powershell.exe`는 WSL에서 실행 불가.
- 개발 중 브라우저 캐시 문제: 시크릿 창 사용 또는 DevTools → Network → "Disable cache" 켠 채로 새로고침 (DevTools를 닫으면 비활성화됨).
