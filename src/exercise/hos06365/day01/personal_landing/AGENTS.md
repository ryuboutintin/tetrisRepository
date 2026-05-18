# Repository Guidelines

## Project Structure & Module Organization

This repository contains a small static Markdown editor.

- `index.html`: document structure, Korean UI text, toolbar controls, and stylesheet/script references.
- `styles.css`: visual design, responsive layout, editor pane, preview pane, and Markdown output styles.
- `script.js`: Markdown parsing, toolbar behavior, character/word counts, autosave, clear, and manual save logic.
- `.agents/` and `.codex/`: local automation metadata. Leave these alone unless intentionally changing agent tooling.

There is currently no `src/`, `dist/`, `assets/`, or `tests/` directory. Keep additions simple and colocated unless the project grows enough to justify new folders.

## Build, Test, and Development Commands

No package manager, bundler, or build process is configured.

- `python3 -m http.server 8080`: serve the app locally at `http://localhost:8080/`.
- Open `index.html` directly in a browser for a quick static check.
- `git status --short`: review changed files before committing.

Do not commit generated output or dependency directories unless a build pipeline is added and documented.

## Coding Style & Naming Conventions

Use two-space indentation for HTML, CSS, and JavaScript. Prefer plain browser APIs and avoid adding dependencies for small features.

JavaScript uses camelCase names for variables and functions, such as `parseMarkdown`, `statusText`, and `wrapSelection`. Keep functions focused and grouped near related event handlers. CSS class names use kebab-case, such as `app-header` and `editor-shell`. Store reusable colors and layout values in `:root` custom properties.

Keep user-facing text consistent with the existing Korean interface unless a change explicitly introduces localization.

## Testing Guidelines

There is no automated test framework or coverage requirement yet. Manually verify these flows before opening a pull request:

- Markdown input updates the preview immediately.
- Bold, italic, heading, list, code, and link toolbar buttons modify selected text correctly.
- Autosave, save, reload, and clear behavior work through `localStorage`.
- The two-pane desktop layout and single-column mobile layout remain usable.

If automated tests are introduced, place them under `tests/` and add the exact test command here.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits and some Conventional Commit style, for example `feat(day01): add markdown editor with live preview`. Prefer concise messages with scope when useful, such as `fix(day01): preserve code block whitespace`.

Pull requests should include a short summary, manual test notes, linked issue if applicable, and screenshots or recordings for visible UI changes.
