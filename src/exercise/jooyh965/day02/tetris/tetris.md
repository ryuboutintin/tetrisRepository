# Tetris 작업 기록

KOSA 바이브 코딩 2026 2기 — Day02 과제로 브라우저에서 바로 실행 가능한 테트리스를 만든 과정 정리.

## 결과물

| 파일 | 역할 |
|------|------|
| `index.html` | 게임 본문 (Canvas + 사이드 패널) |
| `style.css` | 게임 화면 다크 테마 스타일 |
| `script.js` | 게임 로직 (Vanilla JS, 의존성 없음) |
| `landing.html` | 인트로 페이지 (단일 파일, 인라인 CSS) |

## 실행 방법

의존성/빌드 없음. 두 가지 방식 모두 지원:

```bash
# 1) 정적 서버
cd src/exercise/jooyh965/day02/tetris
python3 -m http.server 8001
# http://localhost:8001/landing.html (인트로) 또는 /index.html (바로 게임)
```

또는 파일 탐색기에서 `index.html` / `landing.html` 더블클릭으로 `file://` 실행.

## 기능 명세

### 게임 본문 (`index.html` + `script.js`)

- **보드**: 10 × 20, 셀 크기 30px, 캔버스 300×600
- **블록 7종**: I / O / T / S / Z / J / L (표준 색상)
- **랜덤화**: 7-bag 방식 — 한 사이클 안에 7종이 정확히 1번씩 등장
- **회전**: 4×4 행렬 시계방향 회전 + 벽 킥 (`-2, -1, +1, +2` 셀 오프셋 순차 시도)
- **고스트 피스**: 현재 블록이 떨어질 자리를 반투명 윤곽선으로 미리 표시
- **점수 체계**:
  - 라인 클리어: 1줄 100 · 2줄 300 · 3줄 500 · 4줄 800, 모두 현재 레벨 곱
  - 소프트 드롭: 1 셀당 +1
  - 하드 드롭: 이동 거리 × 2
- **레벨**: 10라인마다 +1, 낙하 간격 `max(80, 800 − (level−1)×70)` ms
- **상태**: 일시정지(P) / 게임오버 시 오버레이 카드 표시
- **종료 조건**: 새 블록이 스폰 위치에서 충돌하거나, 잠금 시 보드 위쪽으로 빠져나간 경우

### 조작 키

| 키 | 동작 |
|----|------|
| `←` / `→` | 좌우 이동 |
| `↓` | 소프트 드롭 |
| `↑` | 회전 |
| `Space` | 하드 드롭 |
| `P` | 일시정지 |
| `R` | 재시작 |

### 인트로 페이지 (`landing.html`)

- 그라데이션 타이틀 + 카피 + `PLAY →` 버튼 (`index.html` 로 진입)
- 떠다니는 7색 데코 블록 (CSS 애니메이션, `prefers-reduced-motion` 존중)
- 10×5 정적 미니 보드로 게임 분위기 미리보기
- 핵심 기능 카드 4종 (7-bag / 고스트 피스 / 벽 킥 / 레벨 가속)
- 조작 키 표 (`<kbd>` 스타일)
- 단일 파일 구조 (인라인 CSS) — 외부 의존 없음

## 작업 흐름 요약

1. **초기 구현** — `index.html`, `style.css`, `script.js` 작성. Canvas 기반, 의존성 0개. 정적 서버 띄워서 동작 확인.
   - 커밋: `f5f1106` *feat(day02): 브라우저에서 바로 실행 가능한 테트리스 추가*

2. **시작 화면 오버레이 버그 수정** — HTML `hidden` 속성이 CSS `display: flex` 에 덮여 게임 시작부터 "PAUSED" 카드와 backdrop blur가 캔버스 위에 깔리는 문제.
   - 수정: `style.css` 에 `.overlay[hidden] { display: none; }` 추가
   - 커밋: `e43eefb` *fix(day02/tetris): 시작 화면 PAUSED 오버레이/블러 표시 문제 수정*

3. **인트로 페이지 추가** — `landing.html` 신설. 게임 진입 전 타이틀/기능 소개/조작 안내.
   - 커밋: `da013d3` *feat(day02/tetris): 인트로 랜딩 페이지 추가*

## 구조 메모

### `script.js` 주요 함수

| 함수 | 역할 |
|------|------|
| `emptyBoard()` | 10×20 빈 보드 생성 (`null` 채움) |
| `rotateCW(matrix)` | NxN 행렬 시계 방향 회전 |
| `refillBag()` / `nextFromBag()` | 7-bag 무작위 큐 관리 |
| `collides(piece, dx, dy, shape?)` | 이동/회전 후 충돌 검사 (보드 경계 + 기존 블록) |
| `lockPiece()` | 현재 블록을 보드에 확정, 라인 클리어 호출 |
| `clearLines()` | 가득 찬 행 제거 + 점수/레벨 갱신 |
| `rotate()` | 회전 시도 → 충돌 시 벽 킥 오프셋 순차 시도 |
| `drawBoard()` | 매 프레임 보드 + 고스트 + 활성 블록 렌더 |
| `loop(time)` | `requestAnimationFrame` 루프, `dropInterval()` 마다 자동 낙하 |

### 컬러 토큰 (`style.css` / `landing.html` 공통)

| 변수 | 값 | 용도 |
|------|----|------|
| `--bg` | `#0f111a` | 페이지 배경 |
| `--panel` | `#1a1d2e` | 사이드 패널 |
| `--accent` | `#7c83ff` | 보라 강조 |
| `--accent-2` | `#ff7eb6` | 분홍 강조 |
| `--c-i ~ --c-l` | 7색 | 테트로미노 색상 |

## 다음에 손볼만한 것

- 모바일 터치 컨트롤 (스와이프/탭)
- 홀드(Hold) 슬롯
- 점수 랭킹 `localStorage` 저장
- 사운드 효과 (라인 클리어, 하드드롭)
- 백그라운드 → 자동 일시정지 (`visibilitychange`)
