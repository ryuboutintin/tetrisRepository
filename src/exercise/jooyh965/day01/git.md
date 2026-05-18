# Git 작업 기록 — day01

이 세션에서 수행한 git 작업을 정리한 문서입니다.

## 작업 요약

총 3건의 커밋·푸시를 진행했습니다.

| # | 내용 | 커밋 해시 | 커밋 메시지 |
|---|------|----------|-------------|
| 1 | 개인 랜딩 페이지 (HTML/CSS) | `2c6a471` | `feat: add personal landing page with HTML/CSS` |
| 2 | 마크다운 에디터 (HTML/CSS/JS) | `b477aba` | `feat: add markdown editor with live preview` |
| 3 | CLAUDE.md (jooyh965 워크스페이스용) | `4755346` | `docs: add CLAUDE.md for jooyh965 workspace` |

## 사용한 워크플로우

매 푸시마다 동일한 패턴을 따랐습니다.

```bash
# 1. 변경 사항 확인
git status

# 2. 명시적으로 파일만 스테이징 (`git add -A` 사용 금지)
git add src/exercise/jooyh965/<path>/<file>

# 3. 커밋
git commit -m "<type>: <summary>"

# 4. 푸시 시도
git push origin main
```

## 마주친 이슈와 해결

### 이슈 1 — 푸시 거부 `! [rejected] main -> main (fetch first)`

다른 동료들이 같은 시간대에 `main`에 푸시하고 있어, 로컬이 원격보다 뒤처진 상태에서 푸시가 거부됨.

**해결**: rebase로 원격 커밋 위에 내 커밋을 올린 후 재푸시.

```bash
git pull --rebase origin main
git push origin main
```

세 번의 푸시 모두 이 과정을 거쳤습니다 (1차 거부 → rebase → 2차 푸시 성공).

### 이슈 2 — CLAUDE.md를 어디에 둘 것인가

처음에 리포 루트(`/CLAUDE.md`)에 생성했으나, 이는 **모든 학생의 Claude Code 세션**에 영향을 주는 공유 파일임을 인지하고 본인 디렉토리로 이동.

**해결**: `src/exercise/jooyh965/CLAUDE.md`로 이동. 다른 학생들(`hoho12`, `hyunhong93`)도 동일한 패턴을 따르고 있었음.

```bash
git restore --staged CLAUDE.md
mv CLAUDE.md src/exercise/jooyh965/CLAUDE.md
git add src/exercise/jooyh965/CLAUDE.md
```

## 배운 점

- **명시적 스테이징의 중요성**: `git status`에는 다른 학생의 untracked 파일이나 `src/exercise/kosa-vibecoding-2026-2nd/`(재귀 클론 잔재)가 섞여 보일 수 있음. `git add .`은 금지.
- **공유 리포에서는 rebase가 필수**: 모두가 `main`에 직접 푸시하는 환경이라, 푸시 전 `git pull --rebase`로 동기화하는 습관이 필요.
- **파일 위치의 scope를 의식**: 루트 파일은 리포 전체에 영향. 본인 디렉토리 안에 두면 본인 작업에만 영향.

## 사용한 주요 명령어 정리

```bash
git status                         # 상태 확인
git add <file>                     # 명시적 스테이징
git commit -m "<msg>"              # 커밋
git pull --rebase origin main      # 원격 동기화 (rebase)
git push origin main               # 원격 푸시
git restore --staged <file>        # 스테이징 해제
git log --oneline -5               # 최근 커밋 5개 확인
git ls-tree origin/main <path>     # 원격의 특정 경로 파일 확인
git fetch origin                   # 원격 정보 갱신 (병합 없이)
```
