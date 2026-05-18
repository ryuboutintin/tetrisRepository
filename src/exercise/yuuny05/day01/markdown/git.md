# Git 작업 프로세스

## 1. 현재 폴더 파일 확인

```bash
ls src/exercise/yuuny05/day01/markdown/
```

## 2. Git 상태 확인

```bash
git status
```

## 3. 변경 파일 스테이징 (명시적 경로 사용)

```bash
git add src/exercise/yuuny05/day01/markdown/
```

> `git add -A` 대신 명시적 경로를 사용해 다른 참가자 파일이 실수로 포함되는 것을 방지합니다.

## 4. 커밋

```bash
git commit -m "커밋 메시지"
```

## 5. 원격 최신화 (merge 방식)

```bash
git pull --no-rebase origin main
```

> **rebase 금지**: `git pull --rebase` 또는 `git pull -r`은 사용하지 않습니다.  
> 여러 참가자가 동시에 `main`에 커밋하므로 반드시 merge 커밋으로 통합합니다.

## 6. Push

```bash
git push origin main
```

---

## 주의사항

- pull 중 다른 참가자 폴더의 merge가 발생하는 것은 **정상**입니다.
- 충돌 발생 시 rebase로 전환하지 말고 **merge 커밋 안에서 해결**합니다.
- 본인 폴더(`src/exercise/yuuny05/`) 내부만 수정합니다.
