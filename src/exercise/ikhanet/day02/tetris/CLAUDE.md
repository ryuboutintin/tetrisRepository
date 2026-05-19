# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행 방법

단일 HTML 파일이므로 빌드 과정 없음.

```bash
# 이 디렉터리에서 실행
python3 -m http.server 8765
# 브라우저: http://localhost:8765/index.html
```

또는 `index.html`을 브라우저에서 직접 열어도 동작한다 (`file://` 프로토콜).

## 구조

`index.html` 하나에 HTML·CSS·JS가 모두 담긴 자급자족 파일 (708줄).

### 두 개의 화면 (SPA 방식 show/hide)

| ID | 설명 | 초기 상태 |
|----|------|----------|
| `#landing` | 조작법·점수표 안내 + PLAY 버튼 | 표시 |
| `#game` | 캔버스 게임 화면 | `display:none` |

PLAY 버튼 클릭 → `initAudio()` 호출(AudioContext 생성) → landing 숨김, game 표시.

### JS 코드 구성

**BGM (상단부)**
- `MELODY` — `[note, beats]` 배열로 인코딩된 코로베이니키(A-B-A 구조, 80박자 루프)
- `scheduleBGM()` — `AudioContext` 타임라인에 `OscillatorNode`들을 미리 스케줄링, `setTimeout`으로 루프
- `stopBGM()` — 타이머 취소 + `gainNode.gain = 0` 으로 즉시 묵음
- `toggleMute()` — `gainNode.gain`을 0↔0.08 토글, 뮤트 상태는 `muted` 변수로 보존

> AudioContext는 반드시 유저 제스처(PLAY 클릭) 이후에 생성해야 브라우저 autoplay 정책을 우회할 수 있다.

**게임 상태 변수**
```
board    — ROWS×COLS 2D 배열 (null = 빈칸, 색상 문자열 = 채워진 칸)
current  — { shape, color, x, y }  현재 낙하 중인 블록
next     — 다음 블록
running  — 게임 진행 중 여부 (키 입력·tick 가드로 사용)
loopId   — setInterval ID
```

**핵심 함수 흐름**
```
tick() → valid()로 한 칸 낙하 가능 여부 확인
       → 불가능하면 place() → sweep() → 새 블록 생성 or endGame()
hardDrop() → 최하단 위치까지 current.y 이동 → place()
startGame() → 상태 초기화 → setInterval(tick) → startBGM()
endGame()   → clearInterval → stopBGM() → renderGameOver()
```

**렌더링**
- `render()` = `renderBoard()` + (running이면) `renderGhost()` + `renderCurrent()` + `renderNext()`
- `drawCell(cx, x, y, color, size)` — 하이라이트/그림자 포함한 블록 한 칸을 canvas에 그림
- 고스트 피스: `valid()`로 최하단 y를 계산해 반투명 윤곽선으로 표시

### 게임 규칙 상수

| 항목 | 값 |
|------|----|
| 보드 크기 | 10 × 20, 셀 30px |
| 속도 공식 | `Math.max(80, 800 - (level-1) * 70)` ms |
| 레벨업 | 10줄마다 +1 |
| 점수 | 1줄:100 / 2줄:300 / 3줄:500 / 4줄:800 × 레벨 |
| 회전 | 시계 방향 90° (`rotate90`) |
