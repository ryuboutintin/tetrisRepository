# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git 정책

원격 변경사항을 통합할 때 **항상 merge**를 사용하고, **rebase는 금지**합니다.

```bash
git pull --no-rebase origin main
```

- `git pull --rebase`, `git pull -r`, `git rebase`는 절대 사용하지 않습니다.
- 히스토리 정리 목적으로도 rebase를 제안하거나 실행하지 않습니다.
- 충돌이 발생하면 merge 커밋 안에서 해결합니다.
