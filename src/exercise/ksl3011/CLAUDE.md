# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**루트 디렉터리**: `src/exercise/ksl3011/` — 이 CLAUDE.md가 위치한 곳이 작업 기준 루트이며, 모든 상대 경로는 여기서 시작한다.

## Git 정책

- 브랜치 통합 시 **항상 머지(merge)** 사용. 리베이스(rebase) 금지.
- `git pull` 시에도 `--rebase` 옵션 사용 금지 (`git pull --no-rebase` 또는 머지 전략 유지).

## 실행 방법

**HTML 파일** — 별도 빌드 없이 브라우저에서 바로 열기:
```
python3 -m http.server 8080
```

**Python 스크립트** — Python 3으로 실행:
```
python3 fibonacci/fibonacci.py
python3 pi/pi.py          # 실행 후 자릿수 입력 프롬프트 표시
```

**exercise2 메모앱** — 서버 두 개 동시 실행:
```bash
# 터미널 1 — FastAPI 백엔드 (포트 8000)
cd exercise2
python3 -m uvicorn main:app --port 8000 --reload

# 터미널 2 — 프론트엔드 정적 서버 (포트 8080)
cd exercise2
python3 -m http.server 8080
```
브라우저에서 `http://localhost:8080/index.html` 접속. 최초 1회 패키지 설치 필요:
```bash
python3 -m pip install fastapi uvicorn python-multipart
```

## 프로젝트 구조

공유 빌드 시스템·패키지 매니저·테스트 프레임워크 없이 독립적으로 동작하는 프론트엔드·Python 연습 파일 모음.

| 경로 | 설명 |
|---|---|
| `exercise1.html` | 좌우 분할 Markdown 에디터 (실시간 프리뷰) |
| `personal_landing/` | 다크 테마 개인 랜딩 페이지 (HTML + 별도 CSS) |
| `personal_landing2/index.html` | 에디토리얼 스타일 랜딩 페이지 (단일 HTML) |
| `fibonacci/fibonacci.py` | n번째 피보나치 수 반복 계산 |
| `pi/pi.py` | Chudnovsky 알고리즘으로 임의 자릿수 원주율 계산 |
| `exercise2/` | FastAPI 메모앱 — REST API(SQLite+FTS5) + 바닐라JS 프론트엔드 |

## 구조 설명

### exercise1.html — Markdown 에디터
- 프레임워크 없는 단일 파일 앱. 렌더링에 CDN의 `marked.js` 사용.
- 파일 I/O는 **File System Access API** (`showOpenFilePicker` / `showSaveFilePicker`) 사용, FSA 미지원 브라우저는 `<input type="file">` 폴백으로 처리.
- 다크/라이트 테마는 `localStorage`(`md-editor-theme` 키)에 저장.
- 에디터·프리뷰 분할바는 `mousemove` 이벤트로 드래그하며 두 패널의 `flex-basis`를 직접 조정.

### personal_landing vs personal_landing2
- `personal_landing/`은 스타일을 `style.css`로 분리, CSS 변수 기반 다크 테마 전용.
- `personal_landing2/index.html`은 `<style>` 인라인 단일 파일 구성, 웜 페이퍼 톤 라이트 테마, Google Fonts(`Space Grotesk`, `Noto Sans KR`) 사용.

### pi/pi.py
- `decimal.Decimal`과 동적 정밀도(`getcontext().prec = digits + 5`)로 Chudnovsky 급수 계산.
- `math` 모듈 대신 자체 `factorial()` 구현으로 정밀도 제어를 일관되게 유지.

### exercise2/ — FastAPI 메모앱

#### 백엔드 구조 (`main.py` → `storage.py`)

`main.py`는 HTTP 관심사(요청 파싱, 상태 코드, CORS)만 담당하고 모든 영속성 처리는 `storage.py`에 위임한다. 라우트 핸들러에 비즈니스 로직 없음.

`storage.py`는 함수 호출마다 새 SQLite 연결을 열고 `with` 블록으로 닫는다(공유 연결 객체 없음). 쓰기 작업마다 `memos`와 `memos_fts`를 같은 트랜잭션에서 함께 갱신해 FTS 인덱스를 동기화한다.

**SQLite 스키마** (`data/memos.db`):
```
memos     — id, title, content, tags(JSON string), created_at, updated_at,
             is_deleted(0/1), deleted_at
memos_fts — FTS5 가상 테이블, tokenize='trigram', rowid = memos.id
```

`tags`는 JSON 배열 문자열로 저장(`'["업무","개인"]'`). 태그 필터 쿼리는 `json_each()`로 펼쳐서 검색.

**소프트 삭제 흐름**: `DELETE /memos/{id}` → `is_deleted=1` + FTS 항목 제거. `POST /memos/{id}/restore` → 반전. `DELETE /memos/{id}/permanent` → 실제 행 삭제.

**라우트 선언 순서 주의**: `/memos/tags`, `/memos/trash`, `/memos/export`, `/memos/import` 같은 고정 경로는 반드시 `/memos/{memo_id}` 앞에 선언해야 한다. 그렇지 않으면 `trash` 같은 문자열이 정수 파라미터로 캡처된다.

#### 프론트엔드 (`index.html` + `style.css` + `app.js`)

바닐라 JS, 프레임워크 없음. 상태는 `app.js` 모듈 수준 변수에 보관:
- `allMemos` — 삭제되지 않은 전체 메모 (클라이언트 필터링의 단일 진실 공급원)
- `trashMemos` — 휴지통 메모, 휴지통 뷰 진입 시에만 로드
- `currentId` / `isNew` — 현재 편집 중인 메모
- `activeTag` / `searchInput.value` — `getFilteredMemos()`에서 적용되는 필터 상태

검색과 태그 필터는 클라이언트 사이드에서 `allMemos`를 직접 걸러낸다(API 재호출 없음). 서버의 `?q=` FTS5 엔드포인트는 외부 API 소비자용.

**자동 저장**: title·content·tags 입력 이벤트 → 1500 ms debounce → `doSave(isAuto=true)`. 수동 저장(`Ctrl+S`, 저장 버튼)도 같은 `doSave()` 함수 사용.

**테마**: CSS 커스텀 프로퍼티(`:root` / `[data-theme="dark"]`). `localStorage`의 `memo-theme` 키에 저장.

#### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/memos` | 목록 (`?q=` FTS 검색, `?tag=` 필터) |
| GET | `/memos/tags` | 활성 메모의 고유 태그 목록 |
| GET | `/memos/trash` | 소프트 삭제된 메모 |
| GET | `/memos/export` | 전체 메모 JSON 다운로드 |
| GET | `/memos/{id}` | 단건 조회 |
| POST | `/memos` | 생성 |
| PUT | `/memos/{id}` | 부분 업데이트 (null 필드는 무시) |
| DELETE | `/memos/{id}` | 소프트 삭제 → 휴지통 |
| POST | `/memos/{id}/restore` | 휴지통에서 복구 |
| DELETE | `/memos/{id}/permanent` | 영구 삭제 |
| POST | `/memos/import` | JSON 배열 파일 업로드로 일괄 가져오기 |

**유효성 검사** (Pydantic): `content` 1–50,000자, `title` 최대 200자, `tags` 최대 10개.
