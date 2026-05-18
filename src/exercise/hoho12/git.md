# Git 작업 프로세스

## 기본 커밋 흐름

```bash
# 1. 변경 파일 확인
git status

# 2. 특정 파일만 스테이징 (git add . 대신 파일 지정 권장)
git add src/exercise/hoho12/day01/markdown-editor/app.js
git add src/exercise/hoho12/day01/markdown-editor/index.html

# 3. 커밋
git commit -m "커밋 메시지"

# 4. 푸시
git push origin main
```

## 공용 저장소에서의 푸시 충돌 처리

이 저장소는 여러 수강생이 동시에 push하는 공용 저장소입니다.  
push 전에 다른 사람의 커밋이 먼저 올라가 있으면 아래 오류가 발생합니다.

```
! [rejected] main -> main (fetch first)
error: failed to push some refs to 'github.com:weable-kosa/...'
```

이 경우 `pull --rebase` 로 원격 변경사항을 먼저 가져온 뒤 push합니다.

```bash
git pull --rebase origin main
git push origin main
```

`--rebase` 옵션은 merge 커밋 없이 내 커밋을 원격 커밋 위에 쌓아줍니다.  
이번 세션에서 매 push마다 이 패턴을 사용했습니다.

## 이번 세션 커밋 이력

| 커밋 | 내용 |
|------|------|
| `479fdf0` | 마크다운 에디터 최초 추가 (index.html, style.css, app.js, CLAUDE.md) |
| `5ef3aa9` | 툴바 버튼 7개 및 단축키 5개 추가 |
| `d43de9b` | Ctrl+Shift 단축키 버그 수정 (e.key 대소문자 처리) |

## 주의사항

- `src/exercise/hoho12/` 밖의 파일은 수정하지 않습니다.
- `git add .` 또는 `git add -A` 는 다른 수강생 파일을 실수로 포함할 수 있으므로 파일을 직접 지정합니다.
- WSL 환경에서 git 명령은 `-C <경로>` 옵션으로 작업 디렉토리를 명시하거나, 해당 디렉토리에서 실행합니다.
