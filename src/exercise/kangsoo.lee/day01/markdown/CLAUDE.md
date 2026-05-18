# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

순수 HTML + CSS + JS로 만든 마크다운 에디터. 외부 라이브러리 없이 동작하며 브라우저에서 `index.html`을 직접 열어서 사용한다.

## Running the App

별도의 빌드 과정 없이 브라우저에서 바로 실행한다.

```bash
# 로컬 서버 없이 파일 직접 열기
open index.html

# 또는 간단한 로컬 서버 사용
python3 -m http.server 8080
```

## Architecture

3개 파일로 구성된 단일 페이지 앱이다.

| 파일 | 역할 |
|------|------|
| `index.html` | 레이아웃 구조 (헤더, 툴바, 에디터/프리뷰 패널, 상태바, 다이얼로그) |
| `style.css` | 다크 테마 전체 스타일. CSS 변수(`--bg`, `--surface`, `--accent` 등)로 색상 관리 |
| `app.js` | 마크다운 파서(인라인 IIFE `marked`) + 모든 UI 로직 |

### app.js 구조

- **`marked` IIFE** — 외부 의존성 없는 자체 마크다운 파서. `parseInline()`(인라인 요소)과 `parseBlock()`(블록 요소) 두 함수로 구성
- **LocalStorage 자동저장** — `STORAGE_KEY = 'md-editor-content'`로 저장. 입력 후 600ms 디바운스(`AUTOSAVE_DELAY`) 적용
- **`render()`** — `marked.parse()` 결과를 `#preview`의 `innerHTML`에 직접 주입
- **툴바 액션** — `toolbarActions` 객체에 id→함수 매핑. `wrapSel()`, `prependLine()`, `insertAt()` 세 헬퍼로 편집 처리
- **뷰 모드** — `#editorWrap`의 className(`view-split` / `view-editor` / `view-preview`)을 바꿔 CSS로 패널 표시/숨김

### CSS 뷰 모드 제어

```css
.editor-wrap.view-editor .pane:last-child  { display: none; }
.editor-wrap.view-preview .pane:first-child { display: none; }
```

## Git Policy

- **rebase 금지** — 브랜치 통합 시 항상 `git merge`를 사용한다. `git rebase`는 사용하지 않는다.
- PR 또는 브랜치 병합 시 `git merge --no-ff`를 권장한다 (히스토리 보존).
