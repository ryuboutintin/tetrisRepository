# CLAUDE.md

## Project Overview

This folder contains a standalone browser-based Markdown editor.

The app provides:

- A left-side Markdown input pane
- A right-side live preview pane
- Automatic saving to `localStorage`
- Basic Markdown formatting buttons
- Split, editor-only, and preview-only view modes
- HTML copy, Markdown download, and document clear actions

No build system, package manager, backend, or external runtime dependency is used.

## Files

- `index.html`: Page structure and UI controls. Links to `style.css` and `script.js`.
- `style.css`: Layout, responsive behavior, toolbar styling, preview styling, and toast styling.
- `script.js`: Markdown rendering, editor interactions, localStorage persistence, stats, view switching, copy/download/clear actions.

## Running

Open `index.html` directly in a browser.

There is no required dev server.

## Implementation Notes

- Keep HTML, CSS, and JavaScript in separate files.
- The saved document uses the localStorage key `plain-markdown-editor-content`.
- The live preview is rendered by the local `markdownToHtml()` function in `script.js`.
- User-entered text is escaped with `escapeHtml()` before inline Markdown replacements.
- View mode buttons toggle `editor-only` and `preview-only` classes on `#workspace`.
- The app is responsive: under `860px`, panes stack vertically and single-pane modes hide the other pane.

## Git Policy

- Do not use `git rebase`.
- Always use merge-based workflows when integrating branches.
- If a pull requires integration, use merge behavior rather than rebase behavior.

## Verification

Useful checks after JavaScript edits:

```bash
node --check script.js
```

For behavior changes, manually verify in the browser:

- Typing updates the preview immediately.
- Refreshing restores saved content from localStorage.
- Split/editor/preview buttons switch layouts.
- Formatting buttons update selected text or insert Markdown.
- Download creates `document.md`.
- Clear empties the editor after confirmation.
