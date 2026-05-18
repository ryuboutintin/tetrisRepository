# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 구조

```
sjpark/
└── day01/
    ├── index.html              # 미커밋 상태의 임시 파일
    └── markdown/
        ├── markdown_page.html  # 진입점 HTML
        ├── style.css           # 전체 스타일
        └── app.js              # 마크다운 렌더링 로직
```

## 실행 방법

별도의 빌드 도구 없음. `markdown_page.html` 을 브라우저에서 직접 열면 동작.  
`marked.js` 는 CDN(`jsdelivr.net`)에서 로드되므로 인터넷 연결 필요.

## 아키텍처

### 마크다운 에디터 (`markdown/`)

- **split-pane 레이아웃**: CSS Grid `1fr 1fr` 로 에디터(왼쪽) / 미리보기(오른쪽) 분리
- **실시간 렌더링**: `app.js` 에서 `textarea#editor` 의 `input` 이벤트마다 `marked.parse()` → `#preview-output.innerHTML`
- **모바일 탭 전환**: JS 없이 CSS Radio Trick 으로 구현
  - `<input type="radio">` 두 개가 `.app` 의 형제(sibling)로 `<body>` 직속에 위치해야 함
  - `#tab-editor:checked ~ .app .pane--editor { display: flex }` 패턴으로 탭 전환
  - 이 구조를 변경하면 모바일 탭이 동작하지 않음
- **에디터 테마**: Catppuccin Mocha (`--ed-bg: #1e1e2e`)

## Git 규칙

- **머지 방식**: rebase 금지, 항상 `--no-rebase` 머지 사용
- **push 전**: 반드시 `git pull --no-rebase --no-edit` 선행
