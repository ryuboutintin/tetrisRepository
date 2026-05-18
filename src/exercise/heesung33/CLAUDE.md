# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

KOSA 바이브코딩 2026 2기 과정의 개인 연습 디렉토리(`heesung33`). 일별 폴더(`day01`, `day02`, ...)로 과제를 구성한다.

## Git Policy

- **rebase 금지** — 항상 `git merge`를 사용한다. `git rebase`, `git pull --rebase` 등 rebase 관련 명령을 절대 실행하지 않는다.
- 커밋 메시지는 한글로 작성해도 무방하다.

## Commands

### Python 테스트 실행

```bash
# 단일 테스트 파일
cd src/exercise/heesung33/day01/fibonacci && python -m unittest test_fibonacci

# 특정 테스트 케이스
python -m unittest test_fibonacci.TestFibonacci.test_fibonacci_100
```

### 프론트엔드 (정적 HTML)

별도 빌드 없음. 브라우저에서 `index.html`을 직접 열거나 간단한 서버를 사용한다:

```bash
cd src/exercise/heesung33/day01/markdown-editor && python -m http.server 8000
```

## Architecture

- `day01/fibonacci/` — Python unittest 기반 알고리즘 연습
- `day01/pi/` — 고정밀 원주율 계산 (decimal 모듈)
- `day01/markdown-editor/` — 순수 HTML/CSS/JS 실시간 마크다운 에디터
- `day01/personal_landing/` — 개인 랜딩 페이지 (정적 HTML)

각 과제는 독립적이며 외부 패키지 매니저(npm, pip install)를 사용하지 않는다.
