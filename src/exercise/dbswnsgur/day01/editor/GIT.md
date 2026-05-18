# GIT.md

## 브랜치 통합 정책

- 브랜치 통합 시 `rebase` 금지, 항상 `merge` 사용
- fast-forward merge가 가능한 경우에도 merge 커밋을 남기는 것을 권장

## &&pcmp 워크플로우

작업 완료 후 아래 순서로 원격에 반영한다.

```bash
# 1. Pull — 원격 최신 상태 가져오기
git pull

# 2. Commit — 변경사항 로컬에 저장
git add <파일>
git commit -m "type: 커밋 메시지"

# 3. Merge — 브랜치 통합 (필요한 경우)
git merge <branch>

# 4. Push — 원격에 반영
git push origin main
```

## 커밋 메시지 컨벤션

```
feat:  새 기능 추가
fix:   버그 수정
docs:  문서 변경 (CLAUDE.md, GIT.md 등)
style: 코드 스타일/포맷 변경 (기능 무관)
refactor: 기능 변경 없는 코드 구조 개선
```

## 주의사항

- `git push --force` 금지
- `git rebase` 금지
- 커밋 전 `git status`로 불필요한 파일이 포함되지 않았는지 확인
