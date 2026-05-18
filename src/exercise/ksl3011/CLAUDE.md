# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git 정책

- 브랜치 통합 시 **항상 머지(merge)** 사용. 리베이스(rebase) 금지.
- `git pull` 시에도 `--rebase` 옵션 사용 금지 (`git pull --no-rebase` 또는 머지 전략 유지).

## 실행 방법

**HTML 파일** — 별도 빌드 없이 브라우저에서 바로 열기:
```
python3 -m http.server 8080
```

**Python 스크립트** — Python 3으로 실행:
```
python3 fibonacci/fibonacci.py
python3 pi/pi.py          # 실행 후 자릿수 입력 프롬프트 표시
```

## 프로젝트 구조

공유 빌드 시스템·패키지 매니저·테스트 프레임워크 없이 독립적으로 동작하는 프론트엔드·Python 연습 파일 모음.

| 경로 | 설명 |
|---|---|
| `exercise1.html` | 좌우 분할 Markdown 에디터 (실시간 프리뷰) |
| `personal_landing/` | 다크 테마 개인 랜딩 페이지 (HTML + 별도 CSS) |
| `personal_landing2/index.html` | 에디토리얼 스타일 랜딩 페이지 (단일 HTML) |
| `fibonacci/fibonacci.py` | n번째 피보나치 수 반복 계산 |
| `pi/pi.py` | Chudnovsky 알고리즘으로 임의 자릿수 원주율 계산 |
| `exercise2/` | FastAPI 메모앱 — REST API(SQLite+FTS5) + 바닐라JS 프론트엔드. 자세한 내용은 `exercise2/CLAUDE.md` 참조. |

## 구조 설명

### exercise1.html — Markdown 에디터
- 프레임워크 없는 단일 파일 앱. 렌더링에 CDN의 `marked.js` 사용.
- 파일 I/O는 **File System Access API** (`showOpenFilePicker` / `showSaveFilePicker`) 사용, FSA 미지원 브라우저는 `<input type="file">` 폴백으로 처리.
- 다크/라이트 테마는 `localStorage`(`md-editor-theme` 키)에 저장.
- 에디터·프리뷰 분할바는 `mousemove` 이벤트로 드래그하며 두 패널의 `flex-basis`를 직접 조정.

### personal_landing vs personal_landing2
- `personal_landing/`은 스타일을 `style.css`로 분리, CSS 변수 기반 다크 테마 전용.
- `personal_landing2/index.html`은 `<style>` 인라인 단일 파일 구성, 웜 페이퍼 톤 라이트 테마, Google Fonts(`Space Grotesk`, `Noto Sans KR`) 사용.

### pi/pi.py
- `decimal.Decimal`과 동적 정밀도(`getcontext().prec = digits + 5`)로 Chudnovsky 급수 계산.
- `math` 모듈 대신 자체 `factorial()` 구현으로 정밀도 제어를 일관되게 유지.
