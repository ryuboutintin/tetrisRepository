# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행 방법

빌드 도구 없이 정적 파일로 동작한다. `index.html`을 로컬 서버로 열면 된다.

```bash
# 이 폴더에서 실행
python3 -m http.server 8080
# → http://localhost:8080
```

`file://` 직접 열기는 피할 것. CDN 스크립트 로드와 localStorage가 일부 브라우저에서 제한된다.

## 아키텍처

의존성 없는 순수 HTML/CSS/JS 3파일 구조.

- **`index.html`** — 레이아웃 골격. `marked.min.js`를 CDN(`jsdelivr`)으로 로드한 뒤 `app.js`를 실행한다.
- **`style.css`** — `:root`의 CSS 변수로 라이트/다크 테마를 관리. `body.dark` 클래스 추가만으로 전체 테마가 전환된다.
- **`app.js`** — 모든 동작 로직. `marked.parse()`로 textarea 값을 HTML로 변환해 `#preview`에 삽입한다.

## localStorage 키

| 키 | 값 |
|----|-----|
| `md-editor-content` | 에디터 내용 (문자열) |
| `md-editor-theme` | `'dark'` 또는 `'light'` |

## 주요 동작 흐름

1. 페이지 로드 시 `localStorage`에서 내용과 테마를 복원한다.
2. `#editor` input 이벤트 → `renderPreview()` 즉시 호출 → 300ms 디바운스 후 `scheduleSave()`로 저장.
3. 구분선(`#divider`) mousedown/mousemove/mouseup으로 `.editor-pane`의 `width`를 직접 조작해 패널 너비를 조절한다 (최소 200px 양쪽).
4. 초기화 버튼은 confirm 후 textarea와 localStorage 키를 모두 제거한다.

## Git 정책

브랜치 통합 시 **rebase를 사용하지 않는다.** 항상 `merge`를 사용한다.

```bash
# 올바른 방법
git merge <branch>

# 금지
# git rebase <branch>
```

## 마크다운 렌더링 옵션

`marked.setOptions`에서 `breaks: true`, `gfm: true`로 설정되어 있다. 옵션을 바꾸면 줄바꿈 처리와 GitHub Flavored Markdown 지원이 달라진다.
