# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git 정책

브랜치 통합 시 `rebase` 대신 항상 `merge`를 사용한다.

```bash
# 올바른 방법
git merge <branch>

# 금지
git rebase <branch>
```

## 실행

```bash
# 현재 디렉토리에서 실행 (포트 3000)
python3 -m http.server 3000
```

브라우저에서 `http://localhost:3000` 접속.

## 구조

외부 의존성 없이 3개 파일로 구성된 바닐라 HTML/CSS/JS 앱.

- `index.html` — 레이아웃 뼈대 (Title → MenuBar → Content 순서)
- `style.css` — CSS 변수 기반 테마 시스템 (`.light` / `.dark` 클래스를 `<body>`에 토글)
- `app.js` — 전체 로직 (렌더링, 메뉴 삽입, 테마 전환)

CDN 의존성:
- `marked.js` — 마크다운 → HTML 파싱 (`marked.parse()`)
- Google Material Icons — 아이콘 폰트

## 핵심 패턴

**메뉴 버튼 추가**: `index.html`의 `<nav>`에 `data-action="새액션"` 버튼을 추가하고, `app.js`의 `templates` 객체에 같은 키로 항목을 추가한다.

```js
// wrap: true  → 선택 텍스트를 before/after로 감쌈 (선택 없으면 placeholder 삽입)
// wrap: false → 커서 위치에 text 삽입
templates['새액션'] = { wrap: true, before: '**', after: '**', placeholder: '텍스트' };
```

**테마**: CSS 변수는 `:root`(공통), `.light`, `.dark` 세 블록에서 선언. JS는 `document.body.classList.toggle('dark', isDark)`로만 전환.
