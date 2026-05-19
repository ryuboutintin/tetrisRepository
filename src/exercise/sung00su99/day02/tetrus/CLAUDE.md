# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Single-file app — no build step needed.

```
python3 -m http.server 8765
# → http://localhost:8765/index.html
```

브라우저에서 직접 열어도 동작하지만, `file://` 프로토콜에서는 Web Audio API가 일부 브라우저에서 차단될 수 있으므로 로컬 서버 권장.

## Architecture

`index.html` 한 파일에 HTML / CSS / JS가 모두 인라인으로 포함된 단일 파일 구조. 두 개의 뷰(`#landing`, `#game-wrapper`)가 전환된다.

### 화면 전환 흐름

```
#landing (초기 표시)
  └─ ▶ PLAY 클릭 → enterGame()
        ├─ #landing 숨김, #game-wrapper 표시
        ├─ AudioContext 생성 (브라우저 정책: 사용자 제스처 후에만 가능)
        └─ #overlay (READY/START 상태) 표시 대기

#game-wrapper → START/RESTART 클릭 → startGame()
  └─ 게임 루프 시작 + BGM 재생
```

### 게임 상태 (전역 변수)

| 변수 | 설명 |
|------|------|
| `grid` | `ROWS×COLS` 2D 배열. 셀 값은 `null` 또는 CSS 색상 문자열 |
| `piece` | 현재 활성 블록 `{ cells, color, x, y }` |
| `nextPiece` | 다음 블록 (동일 구조) |
| `running` | 게임 진행 중 여부. `false`면 루프·키 입력 차단 |
| `clearAnim` | 라인 클리어 애니메이션 상태 (`null` = 비활성). 활성 중에는 드롭 타이머가 멈추고 `piece`가 그려지지 않음 |

### 렌더링 파이프라인

`requestAnimationFrame` → `gameLoop(timestamp)` 호출.

- `clearAnim !== null`: 파티클 위치 갱신 → `drawBoard()` → `drawClearEffect(progress)` → 완료 시 `finalizeClear()`
- 일반 상태: 드롭 타이머 처리 → `drawBoard()` (격자선 → 고정 셀 → 고스트 → 활성 블록 순)

### 라인 클리어 흐름 (중요: 즉시 삭제하지 않음)

```
placePiece()
  ├─ 꽉 찬 행 있음 → startClearAnim(rows)   ← grid는 아직 삭제 안 함
  └─ 없음 → spawnNext()

startClearAnim() 이후 500ms 뒤:
  finalizeClear() → 행 삭제 → 점수·레벨 갱신 → spawnNext()
```

`drawBoard()`는 `clearAnim` 활성 중에는 고스트·활성 블록을 그리지 않는다 (`if (!running || clearAnim) return`).

### 블록(테트로미노) 표현

`SHAPES` 객체에 7종 정의. 각 블록은 `cells: [x, y][]` 로컬 오프셋 배열.  
실제 보드 위치 = `piece.x + cells[i][0]`, `piece.y + cells[i][1]`.  
회전: `rotateCells(cells)` — `[x, y] → [y, maxX - x]` (시계 방향 90°).

### Web Audio BGM (코로베이니키)

- `MELODY` 배열: `[주파수Hz, 지속시간ms][]` 형태. BPM=160, 음형=square
- `playMusic()`: look-ahead scheduling 방식으로 `OscillatorNode`를 미리 스케줄링하고, 루프 종료 전 `setTimeout`으로 재귀 호출
- `stopMusic()`: `musicLoopId++`로 대기 중인 재귀 콜백을 무효화
- `AudioContext`는 `enterGame()`(사용자 클릭) 시점에 생성. 이전에는 `null`.

### 점수 체계 및 LocalStorage

- `SCORE_TABLE = [0, 100, 300, 500, 800]` × 현재 레벨. 10줄마다 레벨 +1.
- 게임 오버 시 `saveBest(score)` → `localStorage['tetris_best']` 갱신. 랜딩 페이지에서 표시.
