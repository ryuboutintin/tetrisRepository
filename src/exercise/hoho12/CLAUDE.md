# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

바이브코딩 2026 2nd 교육 과정의 실습 저장소입니다. GitHub 계정 `sofansil`(hoho12)의 실습 작업물은 `src/exercise/hoho12/` 아래에 위치합니다.

- Remote: `git@github.com:weable-kosa/kosa-vibecoding-2026-2nd.git`
- 공용 저장소이므로 `src/exercise/hoho12/` 밖의 파일은 수정하지 않습니다.

## Running code

```bash
# Python 스크립트 실행
python3 src/exercise/hoho12/day01/Fibonacci.py 20
python3 src/exercise/hoho12/day01/pi.py 100000
python3 src/exercise/hoho12/day01/todo.py

# HTML/JS 앱은 파일을 브라우저로 직접 열어 확인합니다 (빌드 도구 없음)
# WSL 환경에서는 아래와 같이 실행 (! 접두사로 현재 세션에서 실행)
# ! explorer.exe "C:\work\kosa-vibecoding-2026-2nd\src\exercise\hoho12\day01\markdown-editor\index.html"
```

빌드 시스템, 패키지 매니저, 테스트 프레임워크는 사용하지 않습니다.

## Architecture

### day01/

| 경로 | 설명 |
|------|------|
| `markdown-editor/` | 순수 HTML/CSS/JS 마크다운 에디터. CDN으로 marked.js(v5+) 로드. |
| `Fibonacci.py` | 피보나치 수열 생성 (`sys.argv[1]`로 개수 지정) |
| `pi.py` | Nilakantha 급수로 원주율 근사 계산 |
| `todo.py` | 인메모리 TODO 리스트 (add/complete/delete/show) |

### markdown-editor 구조

- `index.html` — 레이아웃 (툴바, 편집 pane, 미리보기 pane)
- `style.css` — 다크테마, 구분선 드래그, 반응형(640px 이하 상하 전환)
- `app.js` — 렌더링, localStorage 자동저장(800ms debounce), 툴바 액션, 단축키

**marked.js 사용 시 주의**: `marked.setOptions()` 은 v5+ 에서 제거됨. 옵션은 `marked.parse(text, { breaks: true, gfm: true })` 형태로 직접 전달해야 합니다.

### 단축키 (markdown-editor)

| 키 | 동작 |
|----|------|
| Ctrl+B | 굵게 |
| Ctrl+I | 기울임 |
| Ctrl+S | 즉시 저장 |
| Tab | 공백 2칸 삽입 |

## Environment notes

- WSL2(Ubuntu) 환경에서 작업합니다.
- Windows 브라우저를 열 때는 `explorer.exe` 경로를 Windows 형식(`C:\...`)으로 전달해야 합니다.
- `cmd.exe`, `powershell.exe`는 WSL에서 바이너리 실행 오류가 발생할 수 있어 `explorer.exe`를 사용합니다.
