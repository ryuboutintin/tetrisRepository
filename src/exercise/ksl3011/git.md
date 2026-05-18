# Git 작업 프로세스

## 기본 원칙

- 브랜치 통합 시 **항상 머지(merge)** 사용
- `rebase` 금지 (`git rebase`, `git pull --rebase` 모두 사용하지 않음)

## 푸시 순서

```bash
# 1. 현재 상태 확인
git status

# 2. 특정 파일만 스테이징 (git add . 보다 명시적으로)
git add <파일경로>

# 3. 커밋
git commit -m "커밋 메시지"

# 4. 푸시 시도
git push origin main
```

## 푸시 충돌 시 처리 (원격에 새 커밋이 있을 때)

`push`가 `rejected`로 실패하면 원격 변경사항을 **머지**로 가져온 후 다시 푸시:

```bash
git pull --no-rebase origin main
git push origin main
```

> `--no-rebase` 옵션으로 머지 전략을 명시적으로 강제. `git pull` 기본 설정이 rebase로 되어 있어도 이 옵션으로 머지를 보장.
