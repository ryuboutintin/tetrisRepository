# Claude Instructions

## Source Scope

This file was generated using only the available metadata for `/init`.

`/init` is not a directory. It is an executable file:

```text
-rwxr-xr-x 1 nobody nogroup 2836528 Apr 25 06:29 /init
```

Because `/init` is not a folder, no project files, source layout, build scripts, tests, or repository-specific conventions could be inferred from it.

## Working Guidance

- Do not assume repository structure from `/init`.
- Inspect the actual project directory before making code changes.
- Prefer small, explicit edits and verify behavior after changes.
- Document any new build, test, or development commands when they are introduced.

## Git Policy

- Do not use `git rebase` in this repository.
- When integrating upstream or branch changes, always use merge-based workflows.
- Prefer commands such as `git pull --no-rebase` or `git merge <branch>` when synchronization is required.
