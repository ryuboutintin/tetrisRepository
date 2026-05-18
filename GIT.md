# GIT.md

이 저장소에서 커밋 → 풀 → 푸시를 진행할 때 사용하는 표준 절차입니다. 루트 `CLAUDE.md`의 **"항상 merge, rebase 금지"** 정책을 실제 작업 흐름으로 풀어 적은 문서입니다.

## 전체 흐름 요약

```
1. 변경사항 확인  → git status / git diff --stat / git log --oneline -5
2. 선택적 스테이징 → git add <명시적 경로>   (git add -A 금지)
3. 커밋           → git commit -m "$(cat <<'EOF' ... EOF)"
4. 원격 동기화     → git pull --no-rebase origin main   (rebase 금지)
5. 푸시           → git push origin main
```

## 1단계 — 현재 상태 확인

세 명령을 **병렬로** 실행해 변경 범위와 최근 히스토리 톤을 한 번에 파악합니다.

```bash
git status
git diff --stat
git log --oneline -5
```

- `git status` 출력에서 **이번 작업과 무관한 untracked 항목**(예: 다른 실습 폴더, 임시 파일)이 보이면 다음 단계에서 **스테이징하지 않습니다**.
- `git log --oneline`은 팀의 커밋 메시지 톤을 확인하는 용도입니다(접두어 `feat:`, `refactor:`, `docs:`, `fix:` 등 conventional commits 스타일).

## 2단계 — 명시적 경로로만 스테이징

```bash
# 좋은 예
git add CLAUDE.md src/exercise/<username>/day01/markdown/

# 금지
git add -A      # 다른 참가자 파일이 섞여 들어올 수 있음
git add .       # 위와 동일한 위험
```

이 저장소는 여러 참가자가 같은 main 브랜치에 작업하기 때문에, 작업 트리에 **본인이 만들지 않은 untracked 파일이 우연히 섞여 들어와 있을 수 있습니다**. `git add -A`로 한 번에 추가하면 그것까지 함께 커밋되어 사고가 납니다. 항상 **본인이 건드린 파일의 경로를 명시**합니다.

스테이징 후 확인:

```bash
git status
```

`Changes to be committed:`에 의도한 파일만 들어 있고, 그 외에는 `Untracked files:`로 그대로 남아 있어야 정상입니다.

## 3단계 — heredoc로 커밋

여러 줄 메시지와 푸터(Co-Authored-By 등)를 안전하게 넣기 위해 **heredoc 패턴**을 사용합니다.

```bash
git commit -m "$(cat <<'EOF'
docs: add CLAUDE.md with repo guide and merge-only git policy

루트에 저장소 안내용 CLAUDE.md를 한글로 추가하고, "rebase 금지,
항상 merge"를 하드 룰로 명시했습니다. markdown 실습 폴더에는
3-파일 구조와 한글 맞춤법 사전 동작 등 폴더 전용 가이드를 따로
배치했습니다.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**메시지 작성 규칙**

- 첫 줄: `<type>: <한 줄 요약>` (영어 OK / 한글 OK, 팀 히스토리는 둘 다 섞여 있음)
- type 예시: `feat`(새 기능), `fix`(버그 수정), `refactor`(기능 변경 없는 구조 개선), `docs`(문서), `chore`(설정/잡일)
- 본문은 **"무엇을"보다 "왜"를** 1~3문장으로
- 빈 줄로 본문과 푸터 구분
- 끝에 Co-Authored-By가 들어가면 GitHub에서 공동 작성자로 표시됩니다

**금지 사항**

- `git commit --amend`로 이미 푸시된 커밋을 수정하지 않습니다 (히스토리 다시 쓰기 = rebase와 같은 위험).
- pre-commit hook 실패 시 `--no-verify`로 우회하지 않습니다. 원인을 찾아 수정한 뒤 **새 커밋**을 만듭니다.

## 4단계 — Pull은 반드시 `--no-rebase`

```bash
git pull --no-rebase origin main
```

- `git pull --rebase`, `git pull -r` **절대 금지**.
- 로컬 git config가 `pull.rebase=true`로 되어 있어도 **명령줄에서 `--no-rebase`로 매번 명시적으로 덮어씁니다**. 사용자 동의 없이 git config를 바꾸지 않습니다.
- 다른 참가자들의 폴더가 함께 머지되어 들어오는 게 정상입니다. 보통 수십 개 파일이 한 번에 추가됩니다. **그들의 파일을 정리하려 들지 마세요.**

**충돌이 발생하면**

1. 충돌한 파일을 열어 `<<<<<<<`, `=======`, `>>>>>>>` 마커를 직접 확인하고 해결합니다.
2. 해결한 파일을 `git add <path>`로 스테이징합니다.
3. `git commit`으로 **merge 커밋을 마무리**합니다 (메시지는 자동 생성 그대로 두거나 가볍게 수정).
4. **`git merge --abort`로 빠져나가서 rebase로 갈아타지 마세요** — 정책 위반입니다.

## 5단계 — 푸시

```bash
git push origin main
```

- `--force`, `--force-with-lease`는 **사용하지 않습니다**. 공유 브랜치에서 force push는 다른 참가자의 작업본을 깨뜨립니다.
- 푸시가 거절되면(`rejected — non-fast-forward`) 거의 항상 누가 그 사이에 커밋한 것입니다. **4단계로 돌아가 pull부터 다시** 합니다. force push가 답이 아닙니다.

## 실제 적용 예 (이번 세션에서 수행한 작업)

```bash
# 1. 상태 확인
git status
# → 신규: CLAUDE.md, src/.../markdown/CLAUDE.md
# → untracked: src/.../personal_landing/  ← 이번 작업과 무관

# 2. 명시적 스테이징 (personal_landing은 의도적으로 제외)
git add CLAUDE.md src/exercise/jeonghana0104/day01/markdown/CLAUDE.md

# 3. heredoc 커밋
git commit -m "$(cat <<'EOF'
docs: add CLAUDE.md with repo guide and merge-only git policy
...
EOF
)"

# 4. merge로 pull (--no-rebase 명시)
git pull --no-rebase origin main
# → 다른 참가자 13개 파일이 merge 커밋으로 통합됨 (정상)

# 5. 푸시
git push origin main
# → e8c2a45 main -> main
```

## 자주 하는 실수와 대처

| 증상 | 원인 | 올바른 대처 |
|---|---|---|
| 의도하지 않은 파일이 커밋 diff에 포함됨 | `git add -A` / `git add .` 사용 | `git reset HEAD <file>`로 unstage 후 명시적 경로로 다시 add |
| 푸시가 `non-fast-forward`로 거절됨 | 그 사이 다른 참가자가 push 함 | `git pull --no-rebase origin main` 후 다시 push (force push 금지) |
| pull 시 `please commit your changes or stash them` | 작업 트리에 미커밋 변경 있음 | 커밋하거나 `git stash` 후 pull, 그다음 `git stash pop` |
| merge 충돌이 무서워서 rebase로 도망가고 싶음 | — | 충돌 해결 후 merge 커밋 마무리. **rebase 절대 금지** |
| 이미 푸시한 커밋 메시지를 고치고 싶음 | — | 고치지 말고, 필요하면 **다음 커밋에 보충**합니다. amend + force push 금지 |
