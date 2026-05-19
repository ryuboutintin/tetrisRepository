# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

hyunhong93의 day02 실습 — HTML/CSS/JS를 분리한 테트리스 게임.
외부 라이브러리·빌드 도구 없이 브라우저에서 바로 실행되는 순수 웹 구현.

## 실행 방법

```bash
# 이 디렉터리에서 실행 (CSS/JS 파일 분리로 서버 필수)
python3 -m http.server 8765
```

접속: `http://localhost:8765/landing.html` → PLAY 버튼으로 게임 진입

## 파일 구조

| 파일 | 역할 |
|------|------|
| `landing.html` | 진입점. 조작법·점수 안내 + PLAY 버튼 → `index.html` |
| `landing.css` | 랜딩 페이지 스타일 (다크 테마, 인포 그리드, 플레이 버튼) |
| `landing.js` | 테트로미노 7종 배너 캔버스 드로잉 |
| `index.html` | 게임 페이지 마크업 (Canvas + 사이드바) |
| `game.css` | 게임 페이지 스타일 (보드, 오버레이, 사이드바 패널) |
| `game.js` | BGM 모듈 + 게임 로직 전체 |
| `PLAN.md` | 구현 계획 문서 |

## 아키텍처 (`game.js`)

세 개의 논리 계층으로 나뉜다.

### 1. BGM 모듈 (`BGM` IIFE)
Web Audio API로 Korobeiniki(Tetris Theme A)를 재생한다.

- `AudioContext` + `GainNode`(master) 구조. 뮤트는 `master.gain.value = 0`으로 처리해 AudioContext를 닫지 않는다.
- 전체 멜로디(NOTES 배열, 38개 음표)를 한 번에 스케줄링하고, `setTimeout`으로 루프를 이어 붙인다.
- 일시정지: `BGM.silence()` → gain=0 / 재개: `BGM.restore()` → gain=0.12
- 재시작: `BGM.stop()`으로 AudioContext를 닫고, `BGM.play()`에서 새로 생성한다.
- 자동재생 정책 대응: `startGame()` 버튼 클릭 시점에 `AudioContext`를 초기화한다.

### 2. 게임 로직
| 함수 | 역할 |
|------|------|
| `isValid(shape, ox, oy)` | 충돌·경계 검사 |
| `rotate(shape)` | 시계 방향 90° 회전 |
| `hardDrop()` | Space 즉시낙하 |
| `clearLines()` | 완성 줄 제거 + 점수·레벨 갱신 |
| `spawn()` | 다음 블록 생성, 게임오버 감지 |
| `lockAndSpawn()` | merge → clearLines → spawn 순서 보장 |

회전 시 wall kick: 중앙(0), ±1, ±2 순으로 시도.

### 3. 렌더링
`requestAnimationFrame` 루프(`loop`)에서 매 프레임 `drawBoard()`를 호출한다.
- 고스트 피스: 현재 블록이 낙하할 위치를 `globalAlpha=0.2`로 표시
- `drawNext()`: 사이드바 미리보기 캔버스에 다음 블록 그리기

## 점수 규칙

| 줄 수 | 점수 |
|-------|------|
| 1 | 100 × 레벨 |
| 2 | 300 × 레벨 |
| 3 | 500 × 레벨 |
| 4 | 800 × 레벨 |

레벨업: 10줄마다. 낙하 속도: `Math.max(100, 1000 - (level-1) * 80)` ms.
