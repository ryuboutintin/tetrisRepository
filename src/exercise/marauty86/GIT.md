# Git Workflow Guidelines

이 프로젝트에서 권장하는 Git 작업 프로세스입니다. 안정적인 협업과 깨끗한 커밋 히스토리를 유지하기 위해 다음 절차를 따릅니다.

## 1. 작업 전 상태 확인
작업을 시작하기 전이나 커밋하기 전에 항상 현재 상태를 확인합니다.
```bash
git status
```

## 2. 변경 사항 검토
내가 수정한 내용이 의도와 일치하는지, 불필요한 코드가 포함되지 않았는지 확인합니다.
```bash
git diff HEAD
```

## 3. 파일 스테이징
커밋할 파일만 명확하게 지정하여 추가합니다. (가급적 `git add .`보다는 개별 파일을 지정하는 것을 권장합니다.)
```bash
git add <file_path>
```

## 4. 커밋 및 메시지 규칙
커밋 메시지는 작업의 성격을 명확히 알 수 있도록 [Conventional Commits](https://www.conventionalcommits.org/) 스타일을 따릅니다.
- `feat:` 새로운 기능 추가
- `fix:` 버그 수정
- `docs:` 문서 수정
- `style:` 코드 포맷팅, 세미콜론 누락 등 (코드 변경 없음)
- `refactor:` 코드 리팩토링

```bash
git commit -m "type: brief description of changes"
```

## 5. 원격 저장소 동기화 및 푸시
협업 중 충돌을 최소화하기 위해 `rebase`를 활용하여 원격의 최신 변경 사항을 먼저 반영한 후 푸시합니다.
```bash
# 원격의 변경 사항을 가져와 내 작업 위로 재정렬
git pull --rebase origin main

# 문제(충돌)가 없다면 푸시
git push origin main
```

## 6. 충돌 해결 (Conflict)
`rebase` 중 충돌이 발생하면:
1. 충돌이 발생한 파일을 수정합니다.
2. 수정한 파일을 `git add` 합니다.
3. `git rebase --continue` 명령어로 rebase 과정을 이어갑니다.
