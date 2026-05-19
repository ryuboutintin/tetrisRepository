# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행 방법

외부 CSS/JS 파일을 참조하므로 로컬 서버가 필요하다:

```bash
python3 -m http.server 8766
# 브라우저에서 http://localhost:8766/ 접속
```

`file://` 프로토콜로 직접 열면 CSS/JS 로드가 실패한다.

## 페이지 구조

두 개의 HTML 페이지가 있으며 각자 역할이 다르다:

- **`index.html`** — 랜딩 페이지. 조작법·점수표를 보여주고 PLAY 버튼으로 `game.html`로 이동.
- **`game.html`** — 게임 페이지. `tetris.js`를 로드하여 Canvas 기반 게임을 실행.

두 페이지 모두 `style.css` 하나를 공유한다. CSS 내부는 `/* ===== Landing Page ===== */`와 `/* ===== Game Page ===== */` 주석으로 섹션이 분리되어 있다.

## tetris.js 아키텍처

파일은 두 책임을 가진다: **BGM**과 **게임 로직**.

### BGM (Web Audio API)
- `initAudio()` — 첫 키 입력 또는 버튼 클릭 시 호출. `AudioContext`와 `masterGain`을 생성하고 BGM 스케줄링을 시작. 브라우저 자동재생 정책 때문에 반드시 사용자 제스처 이후에 호출해야 한다.
- `scheduleBGM(startTime)` — `TETRIS_THEME` 배열의 음표를 AudioContext 타임라인에 일괄 예약한 뒤, `setTimeout`으로 루프 종료 직전에 자신을 재호출한다.
- `scheduleNote(freq, startTime, duration)` — 음표 하나당 `OscillatorNode` + `GainNode` 쌍을 생성. 어택/릴리즈 엔벨로프 적용. `masterGain`에 연결.
- `toggleMute()` — `masterGain.gain`을 0 ↔ `VOLUME`으로 전환. 이미 예약된 오실레이터를 취소하지 않고 마스터 볼륨만 조절한다.
- `TETRIS_THEME` — `[Hz, 박자]` 쌍의 배열. 0Hz = 쉼표.

### 게임 루프
- `board` — `number[20][10]` 2D 배열. 0=빈칸, 1-7=색상 인덱스.
- `piece` / `nextPiece` — `{ matrix, x, y }` 형태. `matrix` 값이 색상 인덱스이다.
- `PIECES` 배열의 각 행렬에서 값이 색상 인덱스 역할을 겸한다 (0=투명, 1-7=색상).
- `collides(matrix, px, py)` — 경계 및 기존 블록과의 충돌을 검사.
- `rotate(matrix)` — 시계방향 90° 회전. 벽킥은 `handleKey` 안에서 ±1 오프셋으로 처리.
- `lockPiece()` → `clearLines()` → `spawnPiece()` 순서로 피스 고정 후처리.
- `animFrameId`로 루프를 추적하며, `startGame()` 호출 시 이전 루프를 `cancelAnimationFrame`으로 정리한다.

## 점수 공식

```
score += LINE_SCORES[cleared] * level
// LINE_SCORES = [0, 100, 300, 500, 800]
// 레벨업: Math.floor(lines / 10) + 1
// 낙하 속도: Math.max(100, 1000 - (level - 1) * 100) ms
```
