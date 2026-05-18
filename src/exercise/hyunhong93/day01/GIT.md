# GIT.md

이 문서는 day01 프로젝트에서 사용하는 Git 작업 프로세스를 정리한 것입니다.

## 기본 정책

- 원격 변경사항을 가져올 때 **rebase 대신 merge** 사용

## 작업 흐름

### 1. 파일 스테이징

```bash
git add <파일명>
```

특정 파일만 명시적으로 추가. `git add .` 또는 `git add -A` 사용 자제.

### 2. 커밋

```bash
git commit -m "커밋 메시지"
```

**커밋 메시지 규칙:**
- 영문 동사 원형으로 시작 (Add, Update, Fix, Refactor 등)
- 무엇을 했는지보다 **왜** 했는지 중심으로 작성

### 3. 원격 변경사항 가져오기 (merge 방식)

```bash
git pull --no-rebase origin main
```

팀원이 push한 커밋이 있을 수 있으므로 push 전에 항상 pull 먼저 실행.

### 4. 푸시

```bash
git push origin main
```

## 전체 순서 요약

```bash
git add <파일명>
git commit -m "메시지"
git pull --no-rebase origin main
git push origin main
```

## 현재 브랜치 및 상태 확인

```bash
git status        # 변경된 파일 확인
git log --oneline -5  # 최근 커밋 확인
```
