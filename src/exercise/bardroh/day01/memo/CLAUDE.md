# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

FastAPI 기반 메모장 앱. JWT 인증, 카테고리·태그 분류, 사용자별 메모 격리를 갖춘 백엔드 CRUD API와 HTML/CSS/JS 프론트엔드로 구성된다. 데이터는 SQLite(`memos.db`)에 영구 저장된다.

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

운영 환경에서는 반드시 `SECRET_KEY` 환경변수를 설정한다.

```bash
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
```

## 파일 구성

| 파일 | 역할 |
|------|------|
| `main.py` | FastAPI 앱 — 인증 + CRUD API + 정적 파일 서빙 |
| `memos.db` | SQLite 데이터베이스 파일 (자동 생성) |
| `index.html` | 프론트엔드 HTML 구조 |
| `style.css` | 2단 그리드 레이아웃, 카드 UI, 필터 바, 반응형 스타일 |
| `app.js` | 인증 흐름, Fetch API 래퍼, 카드 렌더링·인라인 편집, 필터 로직 |
| `requirements.txt` | Python 의존성 |
| `DEPLOY.md` | Ubuntu 22.04 기준 배포 가이드 |

## DB 스키마

`init_db()`가 서버 시작 시 테이블을 자동 생성하고, `ALTER TABLE`로 하위 호환 마이그레이션을 수행한다.

```
users
  id, username (UNIQUE), email (UNIQUE), hashed_password, created_at

refresh_tokens
  id, user_id → users.id, token (UNIQUE), expires_at, revoked

memos
  id, title, content, category (nullable), user_id → users.id

tags
  id, name (UNIQUE)

memo_tags  (M:N 연결)
  memo_id → memos.id  ON DELETE CASCADE
  tag_id  → tags.id   ON DELETE CASCADE
```

- `category`: 고정값 `["업무", "개인", "아이디어", "기타"]` 또는 NULL(미분류)
- `user_id`: 메모 소유자. 타인 메모 접근 시 404 반환 (존재 여부 노출 방지)
- 기존 DB에 컬럼이 없으면 `ALTER TABLE ... ADD COLUMN`으로 무중단 추가

## 백엔드 구조 (main.py)

### 상수
- `SECRET_KEY` — JWT 서명 키. 환경변수 `SECRET_KEY` 우선, 없으면 개발용 기본값
- `ACCESS_TOKEN_EXPIRE_MINUTES = 15` — access token 유효시간
- `REFRESH_TOKEN_EXPIRE_DAYS = 7` — refresh token 유효시간
- `CATEGORIES = ["업무", "개인", "아이디어", "기타"]`

### 인증 흐름
1. `POST /auth/register` → bcrypt 해시 저장
2. `POST /auth/login` → HS256 JWT(access) + 랜덤 opaque token(refresh) 반환
3. 보호 엔드포인트 → `Authorization: Bearer <access>` 헤더 필수
4. access 만료 시 → `POST /auth/refresh`로 새 access token 발급
5. `POST /auth/logout` → refresh token을 DB에서 `revoked=1`로 무효화

### 메모 헬퍼
- `_MEMO_SELECT` — memos + memo_tags + tags LEFT JOIN 쿼리 (GROUP_CONCAT으로 태그 수집)
- `_row_to_memo(row)` — `tag_names` 문자열을 `tags: list[str]`으로 변환
- `_fetch_memo(db, memo_id)` — 단건 조회
- `_upsert_tags(db, memo_id, tag_names)` — memo_tags 재구성 (기존 삭제 후 재삽입)
- `_validate_category(category)` — CATEGORIES 외 값이면 422

### Pydantic 모델

| 모델 | 필드 |
|------|------|
| `MemoCreate` | title, content, category?, tags[] |
| `MemoUpdate` | title?, content?, category?, tags? (None=변경 안 함, []=전체 제거) |
| `MemoResponse` | id, title, content, category?, tags[] |
| `UserRegister` | username, email, password |
| `UserLogin` | username, password |
| `TokenResponse` | access_token, refresh_token, token_type, expires_in |
| `AccessTokenResponse` | access_token, token_type, expires_in |
| `UserResponse` | id, username, email |

## API 엔드포인트

### 인증 (`/auth`)

| 메서드 | 경로 | 동작 | 응답 |
|--------|------|------|------|
| POST | `/auth/register` | 회원가입 | 201 / 409 / 422 |
| POST | `/auth/login` | 로그인 | 200 / 401 |
| POST | `/auth/refresh` | access token 갱신 | 200 / 401 |
| POST | `/auth/logout` | refresh token 무효화 | 204 |
| GET | `/auth/me` | 내 정보 조회 🔒 | 200 / 401 |

### 메모 (🔒 모든 엔드포인트 인증 필요, 본인 소유 메모만 접근 가능)

| 메서드 | 경로 | 동작 | 응답 |
|--------|------|------|------|
| GET | `/memos` | 내 메모 전체 목록 | 200 |
| GET | `/memos/{id}` | 단건 조회 | 200 / 404 |
| POST | `/memos` | 생성 | 201 / 422 |
| PUT | `/memos/{id}` | 부분 수정 | 200 / 404 / 422 |
| DELETE | `/memos/{id}` | 삭제 | 204 / 404 |
| GET | `/categories` | 카테고리 목록 | 200 |
| GET | `/tags` | 사용 중인 태그 목록 | 200 |

타인 소유 메모에 접근하면 403이 아닌 **404**를 반환한다 (존재 여부 노출 방지).

## 프론트엔드 구조

### app.js

**토큰 관리**
- `getAccessToken / getRefreshToken` — localStorage에서 읽기
- `saveTokens / clearTokens` — localStorage 저장·삭제
- `authFetch(url, options)` — 모든 API 호출 래퍼. `Authorization: Bearer` 헤더 자동 첨부. 401 수신 시 `tryRefresh()` 후 재시도. 갱신 실패 시 로그인 화면으로 전환
- `tryRefresh()` — refresh token으로 새 access token 발급 후 저장

**필터 상태**
- `allMemos` — 전체 메모 캐시 (클라이언트 사이드 필터링용)
- `activeCategory` — 활성 카테고리 탭 (`''`=전체, `'__uncat__'`=미분류)
- `activeTags` — 활성 태그 필터 Set (AND 조건)
- `applyFilters(memos)` — activeCategory + activeTags 적용 후 반환

**렌더링**
- `renderMemos(memos)` — 필터 적용된 목록 재렌더링
- `renderActiveTags()` — 활성 태그 칩 재렌더링
- `buildCard(memo)` — 카테고리 배지 + 태그 칩 + 수정·삭제 버튼 포함 카드 DOM 생성
- `switchToEditMode(card, memo)` — 카드를 인라인 편집 폼으로 전환 (카테고리 select + 태그 input 포함)

### index.html 구조

```
header           — 앱 타이틀 + 사용자명 + 로그아웃 버튼
#auth-screen     — 로그인 / 회원가입 탭 폼 (로그인 상태면 hidden)
#memo-screen     — 메모 화면 (비로그인 상태면 hidden)
  .filter-bar    — 카테고리 탭 (전체/업무/개인/아이디어/기타/미분류) + 활성 태그 칩
  main
    .panel-add   — 새 메모 폼 (제목, 내용, 카테고리 select, 태그 input)
    .panel-list  — 메모 카드 그리드
```

## 의존성

`requirements.txt`로 관리. 자세한 설치 방법은 `DEPLOY.md` 참조.

```
fastapi>=0.136.1
uvicorn>=0.47.0
python-jose[cryptography]>=3.5.0
passlib[bcrypt]>=1.7.4
```

`sqlite3`, `secrets`, `time` 은 Python 표준 라이브러리에 포함되어 있어 별도 설치 불필요.
