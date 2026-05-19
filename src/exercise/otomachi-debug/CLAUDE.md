# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

이 폴더는 KOSA 바이브코딩 2026 2기 과정의 **otomachi-debug** 수강생 실습 폴더입니다.  
빌드 도구나 패키지 매니저 없이 순수 HTML/CSS/JS로 구성되며, 파일을 브라우저에서 직접 열어 실행합니다.

## Running Projects

빌드·컴파일 단계 없음. 각 HTML 파일을 브라우저로 직접 오픈합니다.

```bash
# 빠른 로컬 서버 (선택)
python3 -m http.server 8080 --directory day01/markdown-editor
# → http://localhost:8080
```

## Folder Structure

```
otomachi-debug/
└── day01/
    ├── exercise1.md          # 실습 과제 명세
    ├── personal_landing/
    │   └── index.html        # CSS 인라인 방식의 단일 파일 랜딩 페이지
    └── markdown-editor/
        ├── index.html        # 레이아웃 및 툴바 마크업
        ├── style.css         # 다크 테마 (CSS 변수 기반)
        └── editor.js         # 마크다운 파서 + 에디터 로직
```

새 실습은 `day02/`, `day03/` 형식으로 날짜별 폴더를 추가합니다.

## Architecture: markdown-editor

### 마크다운 파서 (`editor.js` — `parseMarkdown` 함수)
외부 라이브러리 없이 정규식 체인으로 구현된 커스텀 파서입니다.  
처리 순서가 중요합니다: HTML 이스케이프 → 펜스드 코드블록 → 블록 요소(제목·인용·HR·목록) → 인라인 요소(굵기·기울임·링크) → 단락 래핑.  
순서를 바꾸면 중첩 패턴이 오파싱됩니다.

### 툴바 액션 (`SNIPPETS` 객체)
세 가지 삽입 유형으로 분류됩니다:
- `wrap` — 선택 텍스트를 감싸는 인라인 서식 (`**bold**`)
- `prefix` — 현재 줄 앞에 접두사 추가, 재클릭 시 토글
- `block` — 커서 위치에 고정 문자열 삽입

### 상태 관리
- 에디터 내용은 `localStorage` 키 `"md-editor-content"`에 자동 저장됩니다.
- 뷰 모드(분할/에디터/미리보기)는 `#workspace` 요소의 CSS 클래스(`editor-only`, `preview-only`)로 제어합니다.
- 동기 스크롤은 `syncLock` 플래그로 이벤트 루프를 방지합니다.

### 스타일 규칙
모든 색상과 크기는 `:root`의 CSS 변수로 관리합니다. 새 색상을 하드코딩하지 말고 변수를 추가하세요.

## Git Workflow

작업 전 반드시 pull을 먼저 실행합니다 (다수의 수강생이 같은 `main` 브랜치에 push).

```bash
git pull
# 작업 후
git add src/exercise/otomachi-debug/...
git commit -m "feat: ..."
git push
```

### Merge 정책

**rebase는 절대 사용하지 않습니다. 항상 merge를 사용합니다.**

- `git pull` 시 rebase 옵션을 쓰지 않습니다 (`--rebase` 금지).
- 브랜치 통합은 `git merge`만 사용합니다.
- `git pull` 기본 동작이 rebase로 설정된 환경이라면 명시적으로 merge를 지정합니다:
  ```bash
  git pull --no-rebase
  ```
