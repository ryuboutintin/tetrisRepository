# 테트리스 MVP — 구현 계획

## Context
hyunhong93의 day02 실습으로 HTML/CSS/JS를 분리한 테트리스 게임을 만든다.
랜딩 페이지(조작법·점수 안내) → 게임 페이지(Canvas + Web Audio API BGM) 구조.
브라우저에서 바로 실행되며, 외부 라이브러리·빌드 도구 없음.

## 목표 파일

| 파일 | 역할 |
|------|------|
| `landing.html` | 진입 페이지 — 조작법·점수 안내 + PLAY 버튼 |
| `landing.css` | 랜딩 페이지 스타일 |
| `landing.js` | 테트로미노 배너 캔버스 드로잉 |
| `index.html` | 게임 페이지 마크업 |
| `game.css` | 게임 페이지 스타일 |
| `game.js` | BGM + 게임 로직 전체 |

## 구현 범위 (MVP)

### 게임 로직
- 10×20 그리드
- 7종 테트로미노 (I, O, T, S, Z, J, L) — 각각 고유 색상
- 블록 자동 낙하 (레벨에 따라 속도 증가)
- 좌/우 이동, 소프트드롭(↓), 하드드롭(Space), 회전(↑ or Z)
- 줄 완성 시 제거 + 점수 반영
- 게임 오버 감지 (블록이 천장에 도달)

### UI
- Canvas로 게임 보드 렌더링
- 우측 패널: 점수, 레벨, 라인 수, 다음 블록 미리보기
- 심플하고 깔끔한 다크 테마
- 시작/재시작 버튼, 뮤트 버튼(🔊/🔇)

### BGM
- Web Audio API로 Korobeiniki(Tetris Theme A) 재생
- 뮤트(M 키), 일시정지(P 키) 지원

### 점수 규칙
- 1줄: 100 × 레벨
- 2줄: 300 × 레벨
- 3줄: 500 × 레벨
- 4줄(테트리스): 800 × 레벨
- 레벨업: 10줄마다

### 조작키
- ← → : 좌우 이동
- ↓ : 소프트드롭
- ↑ or Z : 회전
- Space : 하드드롭
- P : 일시정지
- M : 음악 on/off

## 구현 구조

```
landing.html  →  landing.css
              →  landing.js   (테트로미노 배너 캔버스)

index.html    →  game.css
              →  game.js
                  ├── BGM (IIFE) — Web Audio API 루프 재생
                  ├── 상수 (COLS=10, ROWS=20, CELL=30, 테트로미노)
                  ├── 게임 로직 (isValid, rotate, merge, clearLines, spawn)
                  ├── 렌더링 (drawBoard, drawNext)
                  ├── 게임 루프 (requestAnimationFrame)
                  └── 이벤트 핸들러 (keydown, 버튼)
```

## 검증 방법
1. `python3 -m http.server 8765` 실행 후 `http://localhost:8765/landing.html` 접속
2. PLAY 버튼 → 게임 페이지 이동 + BGM 자동 시작 확인
3. 블록 생성 → 이동/회전 → 낙하 → 줄 소거 → 점수 증가 확인
4. P 일시정지 / M 뮤트 / Space 즉시낙하 동작 확인
5. 게임 오버 후 재시작 버튼 동작 확인
