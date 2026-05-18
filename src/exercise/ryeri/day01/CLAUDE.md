# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a vanilla HTML/CSS/JS exercise project (no build tools, no package manager, no framework). Each mini-app is a single self-contained `index.html` file. Open any `index.html` directly in a browser — no server required.

## Architecture

All three apps share the same conventions:

**Single-file structure**: Each `index.html` contains all HTML, CSS (`<style>`), and JS (`<script>`) inline. There are no external dependencies — no CDN links, no npm packages.

**Design system**: All files use a consistent dark theme via CSS custom properties in `:root`. The palette uses `--bg`, `--surface`, `--surface2`, `--border`, `--accent`, `--text`, `--muted` variables. Changes to the theme are made by editing `:root` values.

**Custom Markdown parser**: Both `markdown-editor` and `profile-editor` implement their own regex-based Markdown-to-HTML parser (`parseMd` / `parseMarkdown` function). There is no external Markdown library. The parser handles headings, bold/italic/strikethrough, inline code, fenced code blocks, blockquotes, ordered/unordered lists, tables, links, and images — in that order, which matters for correctness.

**`render()` pattern**: `profile-editor` uses a central `render()` function that reads all form input values and updates the preview card DOM directly. It is called on every `oninput` event. `markdown-editor` uses a similar `render()` that runs `parseMd()` and updates the preview pane.

**localStorage persistence**: Only `markdown-editor` persists content (key: `md_intro`). It auto-saves 600 ms after the last keystroke.

## Apps

| Directory | Purpose |
|-----------|---------|
| `markdown-editor/` | Split-pane Markdown editor with toolbar, section sidebar, drag-to-resize divider, and download/copy |
| `profile-editor/` | Form-driven profile card builder with live preview, color themes, skill tags, and HTML export modal |
| `personal_landing/` | Static personal landing page template — edit HTML directly to customize name, bio, tags, and SNS links |
