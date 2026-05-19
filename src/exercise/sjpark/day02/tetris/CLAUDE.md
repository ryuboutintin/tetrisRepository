# Tetris — CLAUDE.md

## 프로젝트 개요

번들러·외부 라이브러리 없이 브라우저에서 바로 실행되는 순수 HTML/CSS/JS 테트리스 MVP.

---

## 실행 방법

### 로컬 서버로 실행 (권장)

```bash
cd src/exercise/sjpark/day02/tetris
python3 -m http.server 8765
```

브라우저에서 `http://localhost:8765` 접속.
WSL 환경이라면 Windows 브라우저에서도 같은 URL이 동작한다.

### 단일 파일 직접 열기

`index.html`을 브라우저에서 직접 열어도 실행된다.
(모든 스크립트가 로컬 파일이므로 CORS 이슈 없음)

---

## 파일 구조

```
tetris/
├── index.html        # HTML 구조 전용 — 마크업과 스크립트 로드 순서만 담당
├── style.css         # 스타일 전용 — 다크 테마, 레이아웃, 게임오버 오버레이
└── js/
    ├── constants.js  # 상수 (COLS, ROWS, BLOCK, PIECES 7종)
    ├── utils.js      # 순수 유틸 (rotate — 행렬 시계방향 회전)
    ├── board.js      # Board 클래스 — 보드 상태, 충돌 검사, 라인 클리어
    ├── renderer.js   # Renderer 클래스 — Canvas 2D 렌더링 (격자, 고스트, 피스)
    ├── input.js      # Input 클래스 — 키보드 이벤트 바인딩/언바인딩
    ├── game.js       # Game 클래스 — 게임 루프, 이동/회전/드롭, 점수 계산
    └── main.js       # 진입점 — Game 인스턴스 생성, 재시작 이벤트 연결
```

> 스크립트는 `index.html`에서 의존 순서(constants → utils → board → renderer → input → game → main)대로 로드된다.

---

## 게임 기능 (MVP)

| 기능 | 설명 |
|------|------|
| 7종 테트로미노 | I O T S Z J L, 무작위 생성 |
| 블록 이동 | ← → 좌우, ↓ 소프트 드롭, Space 하드 드롭 |
| 블록 회전 | ↑ 시계방향 회전, 벽킥(±1, ±2 오프셋) 지원 |
| 고스트 피스 | 블록이 떨어질 위치를 반투명으로 표시 |
| 라인 클리어 | 완성된 줄 즉시 제거, 위 줄 내려오기 |
| 점수 | 클리어 줄 수에 따라 차등 (1줄 100 / 2줄 300 / 3줄 500 / 4줄 800) × 레벨 배율 |
| 레벨 | 10줄 클리어마다 1 증가, 낙하 속도 자동 상승 |
| 게임 오버 | 블록이 상단을 넘으면 오버레이 표시 |
| 재시작 | "다시 시작" 버튼으로 상태 완전 초기화 |

---

## 아키텍처

### 클래스 구조

```
Game
 ├── Board     — 2D 그리드 상태, 충돌 검사, 피스 고정, 라인 클리어
 ├── Renderer  — gameCanvas / nextCanvas 드로잉
 └── Input     — keydown 이벤트 → Game 콜백 호출
```

- `Board.lock(piece)` 는 `{ overflow, cleared }` 를 반환해 Game이 점수/게임오버를 판단한다.
- `Input`은 `bind()` / `unbind()` 로 게임 오버 시 키 입력을 차단한다.
- 게임 루프는 `requestAnimationFrame` 기반이며 `Game._rafId`로 관리한다.
  재시작 시 이전 루프를 `cancelAnimationFrame`으로 정리한 뒤 새 루프를 시작한다.

### 점수 산식

```
pts = [0, 100, 300, 500, 800][cleared] × level
소프트 드롭: +1점/칸
하드  드롭:  +2점/칸
```

---

## 작업 범위 규칙

- 수정 대상: `src/exercise/sjpark/day02/tetris/` 내부 파일만.
- 스테이징 시 명시적 경로 사용:
  ```bash
  git add src/exercise/sjpark/day02/tetris/
  ```
