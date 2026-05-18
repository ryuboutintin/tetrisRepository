# Git 작업 프로세스

## 기본 정책

- 브랜치 통합 시 **rebase 금지**, 항상 `merge` 사용

## 커밋 & 푸시 절차

### 1. 현재 폴더 파일 확인

```bash
ls
```

### 2. 변경 상태 확인 (현재 폴더 기준)

```bash
git status -- src/exercise/bardroh/day01/markdown/
```

### 3. 파일 스테이징

```bash
git add src/exercise/bardroh/day01/markdown/CLAUDE.md \
        src/exercise/bardroh/day01/markdown/app.js \
        src/exercise/bardroh/day01/markdown/index.html \
        src/exercise/bardroh/day01/markdown/style.css
```

### 4. 커밋

```bash
git commit -m "커밋 메시지"
```

### 5. 원격 변경사항 병합 (push 실패 시)

원격에 새 커밋이 있을 경우 rebase 없이 merge로 pull한다.

```bash
git pull --no-rebase origin main
```

### 6. 푸시

```bash
git push origin main
```

## 주의 사항

- `git pull` 시 반드시 `--no-rebase` 옵션을 사용한다.
- 스테이징은 `git add .` 대신 파일을 명시적으로 지정한다.
- git 루트는 `/home/ubuntu/work/kosa-vibecoding-2026-2nd`이므로 경로를 풀패스로 지정한다.
