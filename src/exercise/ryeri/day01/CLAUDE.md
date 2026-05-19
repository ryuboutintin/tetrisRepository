# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

4개의 미니 앱으로 구성됩니다. 3개는 빌드 도구·프레임워크 없는 순수 HTML/CSS/JS 단일 파일 앱이고, 1개는 FastAPI + SQLite 백엔드에 별도 정적 프론트엔드를 갖춘 서버 앱입니다.

## 실행 방법

- **HTML 앱** (`markdown-editor/`, `profile-editor/`, `personal_landing/`): `index.html`을 브라우저에서 바로 열면 됩니다.
- **memo-api**: Python 의존성 설치 후 서버를 실행합니다.
  ```
  cd memo-api
  pip install -r requirements.txt
  uvicorn main:app --reload
  ```
  `http://localhost:8000`에서 접속합니다. FastAPI 서버가 `/`에서 프론트엔드(`static/index.html`)를 제공하고, `/memos` 하위에 REST API를 노출합니다.

## 아키텍처

### HTML 앱 (공통 규칙)

**단일 파일 구조**: 각 `index.html`에 HTML, CSS(`<style>`), JS(`<script>`)가 모두 인라인으로 작성됩니다. 외부 의존성(CDN, npm 패키지)은 없습니다.

**디자인 시스템**: 모든 파일이 `:root` CSS 커스텀 속성으로 다크 테마를 공유합니다. `--bg`, `--surface`, `--surface2`, `--border`, `--accent`, `--text`, `--muted` 변수를 사용하며, 테마 변경은 `:root` 값만 수정합니다.

**커스텀 Markdown 파서**: `markdown-editor`와 `profile-editor` 모두 정규식 기반 Markdown-to-HTML 파서(`parseMd` / `parseMarkdown`)를 직접 구현합니다. 외부 Markdown 라이브러리는 없습니다. 처리 순서가 결과에 영향을 주므로 순서 변경 시 주의가 필요합니다 — 전체 순서는 `markdown-editor/CLAUDE.md` 참조.

**`render()` 패턴**: `profile-editor`는 `oninput`마다 모든 폼 입력값을 읽어 미리보기 DOM을 갱신하는 중앙 `render()` 함수를 사용합니다. `markdown-editor`도 `parseMd()`를 호출해 미리보기 창을 갱신하는 동일한 패턴입니다.

**localStorage 저장**: `markdown-editor`만 콘텐츠를 저장합니다(키: `md_intro`). 마지막 입력 후 600ms 디바운스로 자동 저장됩니다.

### memo-api

같은 디렉터리에 SQLite(`memos.db`)를 저장하는 FastAPI 서버(`main.py`)입니다. ORM 없이 raw `sqlite3`를 사용하며 `conn.row_factory = sqlite3.Row`로 딕셔너리 형태로 접근합니다. 서버 시작 시 `init_db()`가 테이블을 생성합니다. CORS는 전체 오픈(`allow_origins=["*"]`)입니다. 프론트엔드(`static/index.html`)는 HTML 앱과 동일한 다크 테마 CSS 변수를 사용하고 `fetch`로 API를 호출합니다.

REST 엔드포인트: `GET /memos?search=`, `POST /memos`, `GET /memos/{id}`, `PUT /memos/{id}`, `DELETE /memos/{id}`

## 앱 목록

| 디렉터리 | 설명 |
|----------|------|
| `markdown-editor/` | 툴바·섹션 사이드바·드래그 구분선·다운로드/복사 기능을 갖춘 분할 창 Markdown 에디터 |
| `profile-editor/` | 실시간 미리보기·컬러 테마·스킬 태그·HTML 내보내기 모달이 있는 프로필 카드 빌더 |
| `personal_landing/` | HTML을 직접 편집해 이름·소개·태그·SNS 링크를 수정하는 정적 랜딩 페이지 |
| `memo-api/` | FastAPI + SQLite 메모 CRUD 서버 + 단일 페이지 프론트엔드 |
