# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행 방법

빌드 과정 없음. `index.html`을 브라우저에서 직접 열면 됩니다:

```bash
# WSL
explorer.exe $(wslpath -w index.html)

# macOS
open index.html

# Linux
xdg-open index.html
```

모든 외부 의존성(marked.js, highlight.js, Google Fonts)은 CDN에서 로드되므로 인터넷 연결이 필요합니다.

## 아키텍처

프레임워크와 번들러 없이 세 파일로 구성된 단일 페이지 앱입니다.

**`index.html`** — 정적 구조만 담당합니다. 툴바 버튼은 `data-action` 속성(예: `data-action="bold"`)으로만 JS와 연결되며, 툴바 요소에는 JS용 ID나 클래스를 사용하지 않습니다.

**`script.js`** — 모든 런타임 로직을 담당하며, body 하단의 `<script src>`로 DOM 로드 후 실행됩니다. 핵심 함수:
- `render(text)` — `marked.parse()`를 호출한 뒤, marked.js가 처리하지 못한 `pre code` 블록에 `hljs.highlightElement()`를 재실행
- `scheduleSave(text)` — 500ms 디바운스 후 `localStorage`에 `midnight-press-content` 키로 저장. 파일 하단의 IIFE에서 초기화 시 복원
- `wrapSelection(before, after)` — `setRangeText`로 현재 textarea 선택 영역에 마크다운 문법 삽입. 선택 영역이 없으면 `"text"` 플레이스홀더로 대체
- `prefixLines(prefix)` — 현재 선택 영역에 포함된 모든 줄 앞에 라인 단위 접두사(예: `# `, `> `) 적용
- 분할창 리사이저 — `pane-editor`와 `pane-preview`의 flex 값을 퍼센트로 직접 업데이트하며, 워크스페이스 너비의 20~80%로 제한

**`style.css`** — 모든 디자인 토큰은 `:root`의 CSS 커스텀 프로퍼티로 정의됩니다. 팔레트는 따뜻한 다크 계열(`--bg-*`), 크림 텍스트(`--text`), 앰버 골드(`--gold`, `--gold-dim`, `--gold-bright`)로 구성됩니다. 폰트 변수는 네 가지: `--font-display`(Playfair Display), `--font-sc`(Playfair Display SC), `--font-mono`(Courier Prime), `--font-body`(Lora). 미리보기 타이포그래피는 에디터나 툴바에 스타일이 번지지 않도록 `#preview` 하위에만 적용됩니다.

## Git 정책

- **머지 전략**: 원격 변경사항을 통합할 때 항상 `--no-rebase` (merge) 를 사용합니다. rebase는 금지입니다.
  ```bash
  git pull --no-rebase origin main
  ```
- 커밋 히스토리를 정리할 목적으로도 `git rebase`를 사용하지 않습니다.

## 주요 제약사항

- **서버 불필요** — `file://` 프로토콜에서 동작하며, 모든 주요 브라우저에서 `localStorage`도 정상 동작합니다.
- **툴바 확장** — `index.html`에 `<button data-action="myaction">`을 추가하고, `script.js`의 `switch` 블록에 `case 'myaction':` 케이스를 추가하면 됩니다.
- **marked.js 버전** — jsDelivr에서 버전 미고정(`marked.min.js` 최신)으로 로드됩니다. 동작이 달라지면 CDN URL에 특정 버전을 명시하세요.
