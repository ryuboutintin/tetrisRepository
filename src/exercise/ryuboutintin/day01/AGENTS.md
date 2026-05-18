# Repository Guidelines

## Project Structure & Module Organization
This repository is a small collection of standalone exercises rather than a single packaged application.

- `pi.py`: command-line Python script that computes pi with the Chudnovsky series.
- `fibonacci/fibonacci.py`: standalone Python implementation of Fibonacci number generation.
- `personal_landing2/index.html`: self-contained HTML page for a Markdown editor UI, including embedded CSS and client-side behavior.
- `h1.txt`, `text.txt`: small text artifacts; treat them as sample or scratch files unless a task says otherwise.

Keep new work similarly isolated. If you add a new exercise, place it in its own directory or single-purpose script file.

## Build, Test, and Development Commands
There is no unified build system yet. Use direct language/runtime commands:

- `python3 pi.py --terms 5 --digits 50`: run the pi calculator locally.
- `python3 fibonacci/fibonacci.py`: run the Fibonacci example.
- `python3 -m http.server 8000`: serve the repository root for browser testing.

For the HTML page, open `personal_landing2/index.html` directly in a browser or use the local server and visit `/personal_landing2/`.

## Coding Style & Naming Conventions
Follow the style already present in the repository:

- Python: 4-space indentation, `snake_case` for functions and variables, type hints where useful, and small focused functions.
- HTML/CSS: 2-space indentation, semantic class names such as `.workspace`, `.preview-card`, and `.topbar`.
- Keep standalone scripts executable through a `__main__` block when they are intended to run directly.

No formatter or linter is configured here yet. Match the surrounding file style and keep changes minimal and readable.

## Testing Guidelines
There is no formal test suite yet. For Python changes, add `pytest`-style tests under a future `tests/` directory when logic becomes non-trivial.

Until then, verify changes by running the target script directly and checking expected output. For UI changes, test `personal_landing2/index.html` in a browser at desktop and narrow mobile widths.

## Commit & Pull Request Guidelines
Recent history shows a mix of Korean summaries and Conventional Commit-style messages such as `feat: add markdown editor...`. Prefer short, imperative commit messages, ideally with a type prefix like `feat:`, `fix:`, or `docs:`.

When integrating branch history, use `git merge` rather than `git rebase`. Preserve shared history unless a maintainer explicitly requests a different strategy.

Pull requests should include a clear summary, the files changed, manual verification steps, and screenshots for UI updates to `personal_landing2/index.html`.
