# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this folder is

A single-page, client-only markdown editor with a Claude-themed UI. Three files, no build step:

- `markdown.html` — page skeleton, inline SVG defs for the logo/buddy, loads `marked.js` from a CDN, then references `markdown.css` and `markdown.js` as separate files.
- `markdown.css` — all styling. Themed entirely through CSS custom properties defined in `:root` (light) and overridden under `[data-theme="dark"]`. The dark theme toggle works by setting `data-theme` on `<html>` — no rules outside the variable block need to change for new themes.
- `markdown.js` — all behavior in a single top-level script (no modules, no bundler). Wires the toolbar, renders the preview via `marked.parse()`, runs the spell check, and manages theme + autosave.

## How to run

Because `markdown.html` references `markdown.css`/`markdown.js` by relative path, opening it via `file://` works in most browsers but is fragile. Prefer a local server from this directory:

```
python3 -m http.server 8765
```

Then open `http://localhost:8765/markdown.html`. WSL: the same URL works from the Windows browser.

There is no test suite, no linter, and no build. "Reload the page" is the dev loop.

## Persistence model

Two `localStorage` keys, both read on load and written on relevant events:

- `claude-md` — current editor content. Written inside `render()` on every keystroke; restored on load only if non-empty (so the seeded sample markdown in the `<textarea>` survives a first visit).
- `claude-md-theme` — `'light'` or `'dark'`. If absent on first load, the initial theme follows `prefers-color-scheme`.

When changing the editor's seeded content, remember that returning visitors will keep seeing their saved version, not the new seed.

## Korean spell check is dictionary-based, not a service

The "✓ 맞춤법 검사" feature is driven entirely by the `KOREAN_TYPOS` array in `markdown.js`. Each entry is `{ wrong, right, reason }`, matched with `indexOf` (no regex, no morphological analysis). Implications:

- Order matters when one entry's `wrong` is a prefix of another's (e.g. `'안되요'` must come before `'안되'`, otherwise the shorter rule consumes the match first). New entries should preserve longest-prefix-first ordering within a group.
- `wrong` strings are matched as plain substrings, so they will fire inside larger words. A few existing entries deliberately include a trailing space (e.g. `'들리다 '`) to avoid that — follow the same pattern when a rule risks over-matching.
- "모두 수정" (`fixAll`) does a global `split/join` per rule across the whole text; "수정" (`fixOne`) replaces only the first occurrence and re-runs detection. Don't unify them — the per-item flow relies on re-detecting after each fix.
