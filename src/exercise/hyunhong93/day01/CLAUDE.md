# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 로컬 서버 실행

```bash
python3 -m http.server 8080
```

접속: `http://localhost:8080`

## 테스트 실행

```bash
# fibonacci 테스트
cd fibonacci
python3 -m pytest test_fibonacci.py

# 단일 테스트 실행
python3 -m pytest test_fibonacci.py::TestFibonacci::test_fibonacci
```

## 프로젝트 구조

### 마크다운 에디터 (`markdown-editor.*`)

3개 파일로 분리된 구조:
- `markdown-editor.html` — 구조(HTML). marked.js를 CDN으로 로드
- `markdown-editor.css` — 다크/라이트 테마 포함 스타일 (`body[data-theme="light"]`로 분기)
- `markdown-editor.js` — 렌더링, 툴바 액션, localStorage 자동저장, 테마 토글 로직

**localStorage 키:**
- `md-editor-content` — 에디터 내용 자동저장 (입력 후 500ms 디바운스)
- `md-editor-theme` — 테마 설정 (`"dark"` / `"light"`)

### fibonacci (`fibonacci/`)

- `fibonacci.py` — 반복문 기반 피보나치 구현 (F(0)=0, F(1)=1)
- `test_fibonacci.py` — unittest 기반 테스트
