# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행 방법

외부 CSS/JS 파일을 참조하므로 반드시 HTTP 서버를 통해 열어야 합니다.

```bash
# tetris/ 디렉터리에서
python3 -m http.server 8765
# 브라우저: http://localhost:8765/index.html
```

`file://` 프로토콜로 직접 열면 CSS/JS 로드가 실패합니다.

## 페이지 구성

| 파일 | 역할 |
|------|------|
| `index.html` | 랜딩 페이지 — 조작법·점수 안내, PLAY NOW 버튼 |
| `game.html` | 게임 페이지 — Canvas 기반 테트리스 본체 |
| `style.css` | 두 페이지 공유 스타일 (게임/랜딩 섹션이 같은 파일에 공존) |
| `game.js` | 게임 로직 전체 + Web Audio API BGM |

## game.js 아키텍처

단일 파일 안에 논리 영역이 주석 구분선(`// ──`)으로 나뉘어 있습니다.

- **상수** — `COLS`, `ROWS`, `CELL`, `PIECES`, `SCORE_TABLE`
- **DOM refs** — 파일 최상단에서 일괄 조회
- **Game state** — `board` (10×20 2D 배열, 빈 셀 `null` / 점유 셀 색상 문자열), `current`/`next` 피스 객체
- **Music** — `MELODY` 배열(`[note, beats]` 쌍)을 Web Audio API 오실레이터로 합성. `startMusic()` 호출 시 `setTimeout` 체인으로 루프, `stopMusic()`으로 해제. `AudioContext`는 `startGame()` 시점(사용자 클릭)에 최초 생성되어 브라우저 자동재생 정책을 우회합니다.
- **Game logic** — `isValid()` 충돌 검사 → `lock()` 착지 → `clearLines()` 라인 소거
- **Rendering** — `requestAnimationFrame` 루프(`loop()`)가 `drawBoard()` + `drawNext()`를 매 프레임 호출
- **Loop & timing** — `setInterval` 기반 자동 낙하, 레벨업 시 `resetDropInterval()`로 속도 재설정
- **Game flow** — `startGame()` / `endGame()` 진입점
- **Input** — `keydown` 이벤트 하나로 모든 키 처리

## 주요 설계 결정

- **점수**: `SCORE_TABLE = [0, 100, 300, 500, 800]` — 인덱스가 클리어한 줄 수, 값 × 레벨
- **낙하 속도**: `Math.max(100, 1000 - (level - 1) * 80)` ms, 레벨 12 이상 최소 100 ms 고정
- **고스트 피스**: `ghostY()`가 현재 형태를 바닥까지 내린 Y 좌표를 반환, 불투명도 25%로 표시
- **뮤트**: `masterGain.gain` 값을 0/0.25로 전환 — 이미 예약된 오실레이터 노드는 건드리지 않음
- **style.css**: 게임 페이지는 ID 선택자(`#app`, `#board` 등), 랜딩 페이지는 클래스 선택자(`.landing-*`)로 충돌 없이 공존
