# Git 작업 프로세스

## 기본 원칙

- 원격 변경사항 통합 시 **항상 merge 전략 사용** (`--no-rebase`)
- `git rebase`는 커밋 히스토리 정리 목적으로도 사용 금지

---

## 커밋 & 푸시 절차

### 1. 현재 상태 확인

```bash
git status
git diff
git log --oneline -5
```

### 2. 변경 파일 스테이징 & 커밋

```bash
git add <파일명>
git commit -m "커밋 메시지"
```

### 3. 원격 변경사항 통합 (merge 전략)

```bash
git pull --no-rebase origin main
```

### 4. 푸시

```bash
git push origin main
```

> push가 rejected될 경우(원격에 새 변경이 생긴 경우) 3번과 4번을 반복합니다.

---

## 주의사항

- `git pull --rebase` 또는 `git rebase` 사용 금지
- push 전 반드시 `git pull --no-rebase`로 원격 상태를 먼저 통합
- 충돌 발생 시 직접 해결 후 merge commit 생성
