# 테트리스 — 랜딩 페이지 + BGM 추가 계획

## Context

기존 MVP(`index.html`)에 두 가지 기능을 추가한다.
1. **랜딩 페이지**: 첫 접속 시 게임 설명·조작법·점수표를 보여주고, 플레이 버튼으로 게임 화면으로 전환
2. **BGM**: Web Audio API로 코로베이니키(테트리스 클래식 테마) 재생. 뮤트 토글 버튼 포함

단일 HTML 파일 구조를 유지한다 (`file://`로 직접 열어도 동작).

## 수정 파일

`src/exercise/ikhanet/day02/tetris/index.html` — 전체 재작성

## 기존 유지 사항

- 클린 화이트 테마 (#f5f5f5, 컬러풀 블록)
- 클래식 레이아웃 (보드 좌, 정보 패널 우)
- 키보드 전용 컨트롤 (← → ↑ ↓ Space)
- 기존 게임 로직 함수 전체 (`valid`, `place`, `sweep`, `rotate90` 등)

---

## 구현 세부 계획

### 1. HTML 구조 — 두 개의 view를 단일 파일에

```html
<div id="landing">   <!-- 초기 표시 -->
  ...랜딩 콘텐츠...
  <button id="play-btn">PLAY</button>
</div>

<div id="game" style="display:none">  <!-- 숨김 상태로 시작 -->
  <h1>TETRIS</h1>
  <div id="game-container">
    <canvas id="board">
    <div id="side-panel">
      ...기존 패널...
      <button id="mute-btn">🔊</button>
      <button id="start-btn">시작</button>
    </div>
  </div>
</div>
```

### 2. 랜딩 페이지 콘텐츠

- 큰 타이틀 "TETRIS"
- 한 줄 소개 문구
- **조작법** 카드: ← → 이동 / ↑ 회전 / ↓ 빠른 낙하 / Space 즉시 낙하
- **점수 계산** 카드 (표 형식):

  | 클리어 | 점수 |
  |--------|------|
  | 1줄    | 100 × 레벨 |
  | 2줄    | 300 × 레벨 |
  | 3줄    | 500 × 레벨 |
  | 4줄 (테트리스!) | 800 × 레벨 |

- **레벨** 카드: 10줄마다 +1, 속도 증가
- PLAY 버튼 (크고 눈에 띄게)

### 3. 페이지 전환

```js
document.getElementById('play-btn').addEventListener('click', () => {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('game').style.display = 'flex';
  initAudio();      // AudioContext 생성 (유저 제스처 직후)
  startBGM();       // BGM 재생 시작
});
```

### 4. Web Audio API — Korobeiniki BGM

음표를 JS 배열로 인코딩. 외부 파일 없이 완전 자급자족.

```js
const FREQ = {
  E4:329.63, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99,
  A5:880.00, B5:987.77, C6:1046.50,
};

// 코로베이니키 멜로디 [음표, 박자(1=4분음표)]  BPM=150, 80박자 루프
const MELODY = [
  ['E5',1],['B4',0.5],['C5',0.5],['D5',1],['C5',0.5],['B4',0.5],  // bar 1
  ['A4',1],['A4',0.5],['C5',0.5],['E5',1],['D5',0.5],['C5',0.5],  // bar 2
  ['B4',1.5],['C5',0.5],['D5',1],['E5',1],                          // bar 3
  ['C5',1],['A4',1],['A4',2],                                        // bar 4
  // ... A-B-A 구조로 20마디
];
```

**BGM 루프 구조**:
- `AudioContext` + `OscillatorNode` (type: `square`) + `GainNode`
- 각 음표를 AudioContext 타임라인에 미리 스케줄링
- 전체 멜로디 길이(32초)를 계산해 `setTimeout`으로 루프 재시작 (120ms 여유)
- BPM: 150

**뮤트 토글**:
```js
let muted = false;
gainNode.gain.setValueAtTime(muted ? 0 : 0.08, audioCtx.currentTime);
```

**게임 오버/재시작 시 BGM**:
- 게임 오버: `stopBGM()` — 타이머 취소 + gain을 0으로 즉시 묵음
- 재시작(시작 버튼): `startBGM()` — gain 복원 후 `scheduleBGM()` 재호출

### 5. CSS 추가

- `#landing`: 중앙 정렬, 카드 그리드 레이아웃
- `.info-card`: 흰 배경, 테두리, 라운드, 그림자 (기존 `.panel-box`와 동일 스타일)
- `#play-btn`: 크게, 파란색, 50px 라운드, hover 시 translateY(-2px)
- 카드 그리드: `display: grid; grid-template-columns: 1fr 1fr; gap: 14px`

---

## 검증 방법

1. `python3 -m http.server 8765` 또는 `file://`로 직접 열기
2. 랜딩 페이지가 첫 화면으로 표시되는지 확인
3. 조작법·점수표·레벨 정보가 올바르게 표시되는지 확인
4. PLAY 버튼 클릭 → 게임 화면으로 전환 확인
5. BGM이 자동 재생되는지 확인 (브라우저 autoplay 차단 없음)
6. 🔇 버튼으로 음소거/해제 토글 확인
7. 게임 오버 시 BGM 정지, 재시작 시 BGM 재개 확인
8. 기존 게임 기능 (이동, 회전, 낙하, 점수) 정상 동작 확인
