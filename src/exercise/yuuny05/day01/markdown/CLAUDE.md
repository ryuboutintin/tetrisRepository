# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

빌드 도구나 패키지 매니저가 없는 순수 정적 웹앱입니다. 브라우저에서 `index.html`을 직접 열거나 간단한 로컬 서버를 사용하세요.

```bash
python3 -m http.server 8080
# 이후 브라우저에서 http://localhost:8080 접속
```

## Architecture

파일 3개로 구성된 단일 페이지 앱입니다.

- **`index.html`** — 좌측 편집 패널(`#markdownInput`)과 우측 미리보기 패널(`#markdownPreview`)을 나란히 배치. CDN에서 [marked.js](https://marked.dev)를 로드해 마크다운 파싱에 사용.
- **`app.js`** — 런타임 로직 전체. `input` 이벤트 → `render()` + `scheduleSave()` 호출. 내용은 `localStorage`(`md-editor-content` 키)에 600ms 디바운스로 자동 저장. 탭 키를 공백 2칸으로 변환하는 `keydown` 핸들러 포함.
- **`style.css`** — 다크 테마 전용 CSS. CSS 변수(`--bg`, `--surface`, `--accent` 등)로 색상 관리. 700px 이하에서 좌우 분할 → 상하 분할로 전환하는 반응형 레이아웃 포함.

## Git Policy

브랜치 통합 시 `rebase` 대신 항상 `merge`를 사용합니다.

```bash
# 올바른 방법
git merge <branch>

# 금지
git rebase <branch>
```

## Key Behaviors

- **자동 저장**: 입력 후 600ms(`SAVE_DELAY`) 뒤 `localStorage`에 저장. 저장 상태는 헤더의 `#saveStatus` 텍스트로 표시.
- **초기화**: `#clearBtn` 클릭 시 `confirm()` 확인 후 textarea, 미리보기, localStorage를 모두 초기화.
- **마크다운 렌더링**: `marked.parse()` 사용, GFM과 줄바꿈(`breaks: true`) 활성화.
