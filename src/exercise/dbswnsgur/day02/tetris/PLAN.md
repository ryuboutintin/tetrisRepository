# Context

`dbswnsgur`의 day02 테트리스 실습. 현재 디렉터리(`src/exercise/dbswnsgur/day02/tetris/`)가 비어 있으므로 새로 생성한다. 외부 CSS/JS 파일을 상대 경로로 참조하므로 로컬 서버가 필요하다.

---

# 생성 파일

| 파일 | 역할 |
|------|------|
| `index.html` | 구조(마크업), CSS/JS 링크 |
| `style.css` | 레이아웃, 다크 테마 |
| `tetris.js` | 게임 로직 전체 (보드, 테트로미노, 입력, 루프) |

> **실행 방법** (로컬 서버 필요):
> ```
> cd src/exercise/dbswnsgur/day02/tetris
> python3 -m http.server 8765
> ```
> 브라우저에서 `http://localhost:8765/` 접속

---

# MVP 기능 범위

| 기능 | 상세 |
|------|------|
| 게임 보드 | 10×20 그리드, HTML5 Canvas 렌더링 |
| 테트로미노 | 7가지 표준 블록 (I, O, T, S, Z, J, L), 색상 구분 |
| 블록 이동 | ← → 좌우, ↓ 소프트드롭, ↑ 또는 Z 회전, Space 하드드롭 |
| 라인 클리어 | 완성된 줄 제거 및 위 블록 낙하 |
| 점수 | 1줄=100, 2줄=300, 3줄=500, 4줄=800 (× 레벨) |
| 다음 블록 | 사이드 패널에 Next 미리보기 |
| 고스트 피스 | 하드드롭 위치 반투명 미리보기 |
| 게임 오버 | 블록이 최상단 초과 시 감지, 화면 오버레이 표시 |
| 재시작 | Enter 키 또는 RESTART 버튼 클릭 |

---

# 구현 설계

## 렌더링
- Canvas 2D API: 메인 보드 (300×600px, 블록 1개 = 30px)
- 미니 Canvas: Next 블록 미리보기 (4×4, 블록 1개 = 25px)
- `requestAnimationFrame` 루프, 레벨별 낙하 속도 조절

## 데이터 구조
```
board: number[20][10]   // 0=빈칸, 1~7=색상 인덱스
piece: { matrix, x, y }
nextPiece: { matrix, x, y }
```

## 디자인 (다크 테마)
- 배경: `#1a1a2e` (진한 네이비)
- 보드 배경: `#16213e`
- 블록 색상: cyan, yellow, purple, green, red, blue, orange
- UI 패널: 우측에 점수·레벨·라인·Next 블록·컨트롤 안내 표시

---

# 검증 방법

1. `python3 -m http.server 8765` 실행 후 `http://localhost:8765/` 접속
2. 키보드로 블록 이동·회전·하드드롭 동작 확인
3. 줄 완성 시 클리어 및 점수 증가 확인
4. 블록이 최상단 도달 시 게임 오버 화면 확인
5. Enter 또는 버튼으로 재시작 동작 확인
