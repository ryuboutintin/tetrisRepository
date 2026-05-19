# Tetris 구현 계획 & 작업 이력

## 최종 구현 파일

- `src/exercise/sung00su99/day02/tetrus/index.html` — 게임 전체 (HTML + CSS + JS 단일 파일)

---

## Phase 1: Tetris MVP

### 목표
브라우저에서 바로 열 수 있는 최소 기능 테트리스. 외부 의존성 없이 HTML + CSS + JS 인라인.

### 구현 내용

| 항목 | 내용 |
|------|------|
| 블록 | 7종 테트로미노 (I, O, T, S, Z, J, L), 색상 구분 |
| 이동 | ← → (좌우), ↓ (빠른 낙하), ↑ (회전), Space (하드 드롭) |
| 낙하 | 레벨에 따라 속도 증가 (`max(100, 1000 - (level-1)*80)` ms) |
| 라인 클리어 | 꽉 찬 줄 제거, 점수 계산 (1줄=100, 2줄=300, 3줄=500, 4줄=800 × 레벨) |
| 레벨업 | 10줄 클리어마다 레벨 +1 |
| 게임 오버 | 스폰 위치 충돌 시 감지, 오버레이 표시 |
| 기술 | `<canvas>` API + `requestAnimationFrame` 게임 루프 |

---

## Phase 2: 랜딩 페이지 + Web Audio BGM

### 목표
첫 접속 시 최고 점수를 보여주는 랜딩 페이지와, Web Audio API로 합성하는 테트리스 테마곡(코로베이니키) 추가.

### 구현 내용

**랜딩 페이지**
- `#landing` → `#game-wrapper` 뷰 전환
- `localStorage['tetris_best']`로 이전 최고 점수 표시
- PLAY 버튼 클릭 시 `AudioContext` 생성 (브라우저 정책: 사용자 제스처 후에만 가능)

**BGM (코로베이니키)**
- 외부 파일 없이 `OscillatorNode` (`square` 파형)로 테마 합성
- look-ahead scheduling: `AudioContext.currentTime` 기준으로 음표를 미리 스케줄링
- `musicLoopId++`로 대기 중인 재귀 루프 콜백 무효화 → 즉시 정지

**점수 저장**
- 게임 오버 시 `saveBest(score)` → `localStorage` 자동 갱신

---

## Phase 3: 라인 클리어 이펙트

### 목표
라인이 사라질 때 화이트 플래시 + 파티클 폭발 애니메이션 추가.

### 핵심 설계: 즉시 삭제하지 않음
행이 꽉 찼을 때 즉시 `grid`에서 삭제하지 않고, 500ms 애니메이션 후 삭제.

```
placePiece()
  ├─ 꽉 찬 행 있음 → startClearAnim(rows)   [grid 유지]
  └─ 없음          → spawnNext()

500ms 후: finalizeClear() → 행 삭제 → 점수·레벨 갱신 → spawnNext()
```

### 이펙트 내용

| 단계 | 내용 |
|------|------|
| 0~250ms | 화이트+황금 그라디언트 플래시 (밝아짐) |
| 250~500ms | 플래시 페이드 아웃 |
| 전체 | 셀별 3개 파티클 (블록 색상, 랜덤 속도, 중력, 페이드) |

- 4줄 동시 클리어 시 최대 120개 파티클
- 애니메이션 중 드롭 타이머 정지, 활성 블록/고스트 미표시 (`clearAnim` 플래그)
- `lastTime` 리셋으로 애니메이션 종료 후 dt 스파이크 방지
