# Repository Guidelines

## Project Structure & Module Organization
This repository is organized as small exercise folders under `src/exercise/jihye/day01/`.

- `markdown_editor/`: standalone HTML + JavaScript markdown editor
- `personal_landing/`: static personal landing page
- `fibonacci/`, `pi/`: simple Python exercises
- `hi.txt`: scratch file for quick checks

Keep new work in a dedicated folder named for the exercise, for example `todo_app/` or `weather_widget/`. Prefer one entry file per simple exercise, such as `index.html` or `main.py`.

## Build, Test, and Development Commands
There is no project-wide build system or dependency manager.

- Open HTML files directly in a browser: `markdown_editor/index.html`
- Serve a folder locally for browser testing: `python -m http.server 8000`
- Run Python examples directly: `python fibonacci/fibonacci.py`

If you add tooling later, document the exact command in the folder that uses it.

## Coding Style & Naming Conventions
- Use 2-space indentation for HTML, CSS, and JavaScript.
- Use 4-space indentation for Python.
- Keep filenames lowercase with underscores or simple folder names, such as `markdown_editor/` or `fibonacci.py`.
- Prefer clear, descriptive variable names and compact inline comments only when logic is non-obvious.
- Keep assets and markup self-contained unless a shared file is clearly justified.

## Testing Guidelines
Automated tests are not currently configured.

- For HTML/JS, verify behavior manually in the browser:
  - page loads without console errors
  - interactive controls work
  - responsive layout behaves on narrow screens
- For Python scripts, run the file directly and confirm the output is correct.

If you add tests, place them beside the exercise or in a clearly named `tests/` folder and document how to run them.

## Commit & Pull Request Guidelines
Recent commits use short, task-focused messages, often in Korean, such as `마크다운` or `exercise1-markdown`. Keep commits concise and scoped to one change.

Git history policy for this repository:

- Do not use `rebase` when integrating changes.
- Prefer merge-based updates, including `git merge` for bringing in upstream work.
- Preserve the existing branch history unless the user explicitly asks for a different workflow.

Pull requests should include:

- a brief summary of what changed
- screenshots or screen recordings for UI work
- notes about manual verification
- links to any related issue, if available

## Agent-Specific Instructions
Do not rename or reorganize existing exercise folders unless the task requires it. Preserve unrelated user changes and keep edits minimal and targeted.
