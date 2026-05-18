# GIT.md

## 기본 push 프로세스

```bash
# 1. 특정 파일만 스테이징 (git add . 사용 금지)
git add <파일경로>

# 2. 커밋
git commit -m "커밋 메시지"

# 3. 푸시
git push origin main
```

## 원격에 새 커밋이 있을 때 (push 거절 시)

`push` 가 거절되면 **rebase 금지**, merge 방식으로 pull 후 재시도:

```bash
git pull origin main   # merge (--rebase 옵션 사용 안 함)
git push origin main
```

## 커밋 메시지 규칙

- 제목은 영문, 현재형 동사로 시작 (`add`, `update`, `fix` 등)
- 본문에 변경 이유나 요약을 간략히 기술
- AI 협업 시 Co-Author 태그 추가

```
git commit -m "$(cat <<'EOF'
한 줄 제목 요약

변경 내용 상세 설명 (선택)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## 주의사항

- `git add -A` 또는 `git add .` 대신 파일을 명시적으로 지정
- `git pull --rebase` 사용 금지 — merge 방식만 사용
- `git push --force` 사용 금지
