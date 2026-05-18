# GIT.md — 이번 세션 Git 작업 이력

## 세션 날짜: 2026-05-18

## 실행한 Git 명령어

### 1. 상태 및 이력 확인

```bash
# 최근 커밋 이력 확인 (작성자 필터)
git log --oneline -20 --author="heesung33"

# 전체 브랜치 그래프 확인
git log --oneline -20 --all --graph
```

### 2. 확인된 최근 커밋 이력

| 커밋 해시 | 메시지 |
|-----------|--------|
| f4df2c2 | Merge branch 'main' of github.com:weable-kosa/kosa-vibecoding-2026-2nd |
| 821b57b | CLAUDE.md 추가 (git merge 정책 포함) |
| 09fbfbf | 마크다운 에디터 툴바 버튼 및 단축키 추가 |
| 765e809 | 실시간 마크다운 에디터 |
| fbdd4bc | 홈페이지 |
| 9dfa004 | Merge branch 'main' |
| 156419e | 원주율 계산기 |
| 54c766d | add fibonacci.py |

## 이 프로젝트의 Git 작업 프로세스

```
[코드 작성/수정]
       ↓
git add <파일명>
       ↓
git commit -m "커밋 메시지"
       ↓
git pull origin main    ← (자동 merge, rebase 금지)
       ↓
(충돌 발생 시 수동 해결 → git add → git commit)
       ↓
git push origin main
```

## 주요 정책

- **rebase 금지**: `git rebase`, `git pull --rebase` 사용하지 않음
- **항상 merge 사용**: 원격 변경사항은 `git pull`(기본 merge 전략)로 통합
- **커밋 메시지**: 한글 허용, 변경 내용을 간결하게 기술
