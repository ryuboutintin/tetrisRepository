# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Local Development

모든 HTML 파일은 빌드 도구 없이 브라우저에서 직접 열 수 있다. 로컬 서버가 필요한 경우:

```bash
# 원하는 폴더에서 실행
python3 -m http.server 8080
# → http://localhost:8080
```

Python 스크립트 실행:

```bash
python3 day01/fibonacci.py
python3 day01/pi.py
```

## Architecture

### Static Web Pages (`day01/`)

빌드 단계 없음. 각 프로젝트는 `index.html` 단일 파일로 완결된다.

- **personal_landing2** — HTML/CSS/JS만 사용. 외부 의존성 없음. 이름·소개·스킬·연락처 섹션 구성.
- **markdown-editor** — CDN에서 `marked.js`(v9)를 로드해 마크다운 파싱. 나머지는 순수 HTML/CSS/JS. 다크모드 상태는 `localStorage`(`md-theme` 키)에 저장.

### markdown-editor 내부 구조

- 좌우 split-pane: 왼쪽 `<textarea id="editor">`, 오른쪽 `<div id="preview">`
- CSS 변수(`--bg`, `--surface`, `--accent` 등)로 라이트/다크 테마 분리 — `[data-theme="dark"]` 셀렉터로 오버라이드
- 툴바 버튼은 `data-action` 속성으로 액션을 선언, JS의 `doAction(action)` 단일 함수에서 처리
- H 버튼은 클릭마다 현재 줄의 `#` 개수를 순환 (없음 → H1 → H2 → H3 → 없음)

## Git Workflow

원격에 새 커밋이 있을 때는 **rebase 금지**, merge 방식으로 pull:

```bash
git pull origin main        # merge (기본값)
git push origin main
```
