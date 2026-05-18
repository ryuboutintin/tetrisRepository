# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

KOSA "vibe coding" 2026 2nd cohort — a shared training repository where each student commits their exercises directly to `main`. There is no application to build; the repo is a collection of independent, per-student exercises.

The course material is in `doc/` (Korean PDF). All instruction, commits, and student-facing communication are in Korean.

## Working directory convention

Each student works exclusively under `src/exercise/<github-username>/` and never modifies other students' directories. There is no shared library or cross-exercise code.

Within a student's directory, two organization patterns are in use — match whichever the current student already uses:
- By day: `src/exercise/<user>/day01/<project>/`
- By project name only: `src/exercise/<user>/<project>/`

Each exercise is a self-contained mini-project (a Python script, a static HTML/CSS/JS page, etc.). There is no repo-wide build system, package manifest, linter, or test runner — only what each exercise brings itself. Don't add one at the repo root.

## Git workflow

Everyone pushes to `main` directly, and many students push concurrently throughout the day. As a result, `git push` is frequently rejected with `(fetch first)`.

**Always `git pull --rebase origin main` before pushing**, and re-push. Do not merge-commit the integration; the history is already noisy enough.

**Stage explicitly**, never `git add -A` or `git add .`:
- Stray untracked directories like `src/exercise/kosa-vibecoding-2026-2nd/` (a recursive clone artifact) appear in `git status` and must not be committed.
- Other students' in-progress untracked files can also appear on a fresh clone.

Only stage files inside the current student's `src/exercise/<user>/...` path, by name.

## Running static-web exercises

For HTML/CSS/JS exercises, serve over HTTP rather than `file://` so relative paths and any `fetch`/module behavior work correctly:

```bash
cd src/exercise/<user>/<path-to-exercise>
python3 -m http.server 8000
# then open http://localhost:8000
```

WSL2 (this environment): `http://localhost:8000` works from the Windows host via auto-forwarding; fall back to the WSL IP (`hostname -I`) if not.
