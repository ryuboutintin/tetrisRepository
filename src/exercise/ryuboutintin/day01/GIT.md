# Git 작업 절차

## 목적
이 문서는 이번 디렉터리에서 실제로 수행한 Git 작업 흐름을 기록합니다.

## 수행한 단계
1. 현재 작업 트리 상태 확인:
   `git status --short`
2. 현재 브랜치와 최근 이력 확인:
   `git branch --show-current`
   `git log --oneline -n 3`
3. 로컬 변경 파일 스테이징 및 커밋:
   `git add AGENTS.md`
   `git commit -m "docs: add repository guidelines"`
4. 원격 저장소로 푸시 시도:
   `git push origin main`
5. `origin/main`에 더 최신 커밋이 있어 푸시가 거절된 경우, `rebase`가 아니라 `merge` 방식으로 원격 변경 반영:
   `git pull --no-rebase origin main`
6. 병합이 끝난 뒤 다시 푸시:
   `git push origin main`

## 참고 사항
- 원격 브랜치가 앞서 있을 때는 `git merge` 기반으로 통합합니다.
- 유지보수자의 별도 요청이 없으면 이 저장소에서는 `git rebase`를 사용하지 않습니다.
- `git push`가 non-fast-forward 오류로 거절되면 `git pull --no-rebase`를 실행하고, 충돌이 있으면 해결한 뒤 다시 푸시합니다.

## 복구 예시 흐름
```bash
git status --short
git add AGENTS.md
git commit -m "docs: add repository guidelines"
git push origin main
git pull --no-rebase origin main
git push origin main
```
