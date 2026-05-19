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

---

# Git 작업 기록 — 추가분 (이번 세션)

위 문서 자체와 exercise2(FastAPI 메모 앱)를 push한 작업 기록입니다.

## 작업 요약

| # | 내용 | 커밋 해시 | 커밋 메시지 |
|---|------|----------|-------------|
| 4 | git 작업 기록 문서 | `22d09c1` | `docs: add git workflow notes for day01 session` |
| 5 | FastAPI 메모 앱 (API + 프론트 + SQLite) | `0270f29` | `feat(exercise2): add FastAPI memo app with frontend and SQLite` |

## 새로 마주친 이슈와 해결

### 이슈 3 — venv 생성 실패 (`ensurepip is not available`)

WSL Ubuntu 22.04에 `python3.10-venv` 패키지가 없어 `python3 -m venv .venv` 실패.

**해결**: 시스템 패키지 설치 (sudo 권한 필요).

```bash
sudo apt update
sudo apt install -y python3.10-venv python3-pip
```

설치 후 `dpkg -l python3.10-venv`로 `ii` 상태 확인하는 습관이 좋음.
(처음에 `python3-venv`로 시도했으나 Ubuntu 22.04 + Python 3.10 조합에서는 버전 명시 패키지 `python3.10-venv`가 정확한 이름)

### 이슈 4 — venv 디렉토리·DB 파일이 untracked로 노출

`exercise2/` 전체가 untracked일 때 `.venv/`, `memos.db`, `__pycache__/`가 모두 보임.

**해결**: 디렉토리에 `.gitignore` 추가하고 **명시적으로 파일명 나열해서 스테이징**.

```
# exercise2/.gitignore
.venv/
__pycache__/
*.pyc
*.db
```

`.gitignore`가 있어도 untracked 표시는 사라지므로, `git add -A`만 피하면 안전.
스테이징은 항상 파일별로:

```bash
git add \
  src/exercise/jooyh965/day01/exercise2/.gitignore \
  src/exercise/jooyh965/day01/exercise2/main.py \
  src/exercise/jooyh965/day01/exercise2/db.py \
  ...
```

확인:
```bash
git ls-tree -r origin/main src/exercise/jooyh965/day01/exercise2/
# .venv/, memos.db, __pycache__/ 가 결과에 없어야 정상
```

## 이번에 추가로 배운 점

- **패키지명 정밀도**: Ubuntu에서 Python 가상환경용 패키지는 `python3-venv`가 아니라 메이저 버전을 포함한 `python3.X-venv` 형태가 정확한 이름인 경우가 많음. `apt`가 모호하면 에러 메시지가 정확한 패키지명을 알려줌.
- **`.gitignore`는 미리**: 새 프로젝트 디렉토리를 만들 때 가장 먼저 `.gitignore`부터 작성하면 staging 사고가 줄어듬. 특히 `.venv/`, `*.db`, `__pycache__/` 같은 산출물.
- **검증을 푸시 직후에**: `git ls-tree -r origin/main <path>`로 원격에 의도하지 않은 파일(가상환경, DB 등)이 섞이지 않았는지 확인하는 게 좋음.

## 이번 세션 총 푸시 커밋

5건 (1차: 랜딩 페이지, 2차: 마크다운 에디터, 3차: CLAUDE.md, 4차: git.md, 5차: FastAPI 메모 앱).
모든 푸시에서 1차 거부 → `git pull --rebase` → 재푸시 패턴이 반복됨. 공동 학습 리포에서는 이 패턴이 기본 워크플로우라는 점을 다시 확인.
