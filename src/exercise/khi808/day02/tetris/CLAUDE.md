# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

단일 파일 앱 — HTML, CSS, JS, 오디오 엔진, 게임 로직 전체가 `index.html` 하나에 있다. 빌드 단계 없음, 외부 의존성 없음.

두 화면은 `showScreen(id)`로 전환하며, 대상 `.screen` 요소에 `.active` 클래스를 추가하는 방식(CSS `opacity` + `pointer-events` 토글)이다.
- `#screen-landing` — 인트로, 조작키 안내, 음악 토글, PLAY 버튼
- `#screen-game` — 게임 보드 + 사이드 패널
- `#overlay` — `#screen-game` 내부에 위치하며 일시정지·게임오버 상태를 표시

## Web Audio API 제약

브라우저는 사용자 제스처(클릭) 이전에 `AudioContext` 생성을 차단한다. `AudioEngine._init()`은 첫 클릭 시점까지 `new AudioContext()` 호출을 미룬다. 사용자 인터랙션 전에 SFX 메서드를 호출하면 안 된다.

`MELODY`는 `[frequency_hz, duration_sec]` 쌍의 배열로 Korobeiniki 테마를 BPM 158로 인코딩한다. 음표 이름 → Hz는 `N` 객체에 정의(`N.A4 = 440`, `N.E5 = 659.25` 등). 스케줄러는 80 ms 간격으로 폴링하며 0.3 s 선행(lookahead) 윈도우로 노트를 큐에 넣는다.

볼륨 페이드는 `setTargetAtTime`으로 처리하며 `musicGain`(BGM)과 `sfxGain`(효과음)이 `masterGain`에 연결된다.

## 게임 상태

클래스 없이 전역 변수로 관리:

| 변수 | 타입·구조 | 설명 |
|---|---|---|
| `board` | `null \| hexStr` 2D 배열 `[ROWS][COLS]` | 고정된 셀 색상 |
| `current` / `next` | `{ type, color, cells: [[x,y],...], x, y }` | 활성·다음 피스 |
| `score`, `lines`, `level` | number | 통계 |
| `dropInterval` | ms | 레벨마다 80 ms씩 감소, 최소 100 ms |
| `dropAccum` | ms | 프레임 델타 누산기 |
| `paused`, `running` | boolean | 게임 제어 플래그 |

## 드롭 타이밍

고정 틱이 아닌 프레임 델타 누산기 방식(`dropAccum += delta`)을 사용한다. 일시정지 해제 후에는 `lastTime = null`로 리셋해야 큰 델타가 쌓여 블록이 즉시 여러 칸 떨어지는 현상을 막을 수 있다.

## 회전

`rotateCells(cells)`는 `[maxY - y, x]` 변환으로 90° 시계 방향 회전을 적용한다. 회전 후 벽 충돌 시 오프셋 `[0, -1, 1, -2, 2]` 순서로 월 킥을 시도한다. 이 오프셋을 바꾸면 게임 조작감이 달라진다.
