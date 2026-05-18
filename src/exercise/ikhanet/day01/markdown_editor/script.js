/* ──────────────────────────────────────────────
   The Midnight Press — script.js
   ────────────────────────────────────────────── */

const STORAGE_KEY = 'midnight-press-content';

const DEFAULT_CONTENT = `# The Midnight Press

*A markdown editor for the quiet hours.*

---

## Getting Started

Write your **manuscript** on the left. The *preview* updates as you type.

### Formatting

Use the toolbar above or keyboard shortcuts:

- **Bold** — \`Ctrl+B\`
- *Italic* — \`Ctrl+I\`
- Headings — toolbar buttons H1, H2, H3

### Blockquote

> "The art of writing is the art of discovering what you believe."
> — Gustave Flaubert

### Code

Inline \`code\` and code blocks:

\`\`\`javascript
function write(thought) {
  return thought.trim();
}
\`\`\`

### Table

| Chapter | Title          | Status   |
|---------|----------------|----------|
| I       | The Beginning  | Draft    |
| II      | Rising Action  | Outline  |
| III     | The Resolution | Planned  |

---

*Your words are auto-saved to this browser.*
`;

// ── Elements ──────────────────────────────────

const editor     = document.getElementById('editor');
const preview    = document.getElementById('preview');
const wordCount  = document.getElementById('word-count');
const lineCount  = document.getElementById('line-count');
const saveStatus = document.getElementById('save-status');
const divider    = document.getElementById('divider');
const paneEditor = document.getElementById('pane-editor');
const panePreview = document.getElementById('pane-preview');

// ── marked.js setup ───────────────────────────

marked.use({
  breaks: true,
  gfm: true,
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

// ── Render ────────────────────────────────────

function render(text) {
  preview.innerHTML = marked.parse(text);
  // Re-run highlight.js on any code blocks not caught by marked
  preview.querySelectorAll('pre code').forEach(block => {
    if (!block.classList.contains('hljs')) {
      hljs.highlightElement(block);
    }
  });
}

// ── Stats ─────────────────────────────────────

function updateStats(text) {
  const lines = text === '' ? 0 : text.split('\n').length;
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  lineCount.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
}

// ── Auto-save (debounced) ─────────────────────

let saveTimer = null;
let flashTimer = null;

function scheduleSave(text) {
  clearTimeout(saveTimer);
  saveStatus.textContent = '— saving —';
  saveStatus.className = 'save-status saving';

  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, text);
    saveStatus.textContent = '— saved —';
    saveStatus.className = 'save-status flash';

    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      saveStatus.className = 'save-status';
    }, 1500);
  }, 500);
}

// ── Input handler ─────────────────────────────

editor.addEventListener('input', () => {
  const text = editor.value;
  render(text);
  updateStats(text);
  scheduleSave(text);
});

// ── Toolbar ───────────────────────────────────

function wrapSelection(before, after = '') {
  const start = editor.selectionStart;
  const end   = editor.selectionEnd;
  const sel   = editor.value.substring(start, end);
  const replacement = before + (sel || 'text') + after;
  editor.setRangeText(replacement, start, end, 'select');
  editor.focus();
  // If we inserted placeholder "text", select just that word
  if (!sel) {
    editor.setSelectionRange(start + before.length, start + before.length + 4);
  }
  editor.dispatchEvent(new Event('input'));
}

function prefixLines(prefix) {
  const start = editor.selectionStart;
  const end   = editor.selectionEnd;
  const lines = editor.value.substring(start, end || start).split('\n');

  // Find line start from cursor
  const beforeCursor = editor.value.substring(0, start);
  const lineStart    = beforeCursor.lastIndexOf('\n') + 1;
  const lineEnd      = editor.value.indexOf('\n', end === start ? start : end);
  const actualEnd    = lineEnd === -1 ? editor.value.length : lineEnd;
  const block        = editor.value.substring(lineStart, actualEnd);

  const prefixed = block.split('\n').map(l => prefix + l).join('\n');
  editor.setRangeText(prefixed, lineStart, actualEnd, 'end');
  editor.focus();
  editor.dispatchEvent(new Event('input'));
}

function insertAtCursor(text) {
  const start = editor.selectionStart;
  editor.setRangeText(text, start, start, 'end');
  editor.focus();
  editor.dispatchEvent(new Event('input'));
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    switch (action) {
      case 'bold':
        wrapSelection('**', '**');
        break;
      case 'italic':
        wrapSelection('_', '_');
        break;
      case 'h1':
        prefixLines('# ');
        break;
      case 'h2':
        prefixLines('## ');
        break;
      case 'h3':
        prefixLines('### ');
        break;
      case 'link': {
        const url = prompt('URL을 입력하세요:', 'https://');
        if (url) wrapSelection('[', `](${url})`);
        break;
      }
      case 'code': {
        const start = editor.selectionStart;
        const end   = editor.selectionEnd;
        const sel   = editor.value.substring(start, end);
        if (sel.includes('\n')) {
          wrapSelection('```\n', '\n```');
        } else {
          wrapSelection('`', '`');
        }
        break;
      }
      case 'blockquote':
        prefixLines('> ');
        break;
      case 'hr':
        insertAtCursor('\n\n---\n\n');
        break;
    }
  });
});

// ── Keyboard shortcuts ────────────────────────

editor.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b') { e.preventDefault(); wrapSelection('**', '**'); }
    if (e.key === 'i') { e.preventDefault(); wrapSelection('_', '_'); }
  }

  // Tab inserts 2 spaces instead of losing focus
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    editor.setRangeText('  ', start, start, 'end');
    editor.dispatchEvent(new Event('input'));
  }
});

// ── Divider drag-to-resize ────────────────────

let isDragging = false;
let dragStartX = 0;
let editorStartWidth = 0;

divider.addEventListener('mousedown', e => {
  isDragging = true;
  dragStartX = e.clientX;
  editorStartWidth = paneEditor.getBoundingClientRect().width;
  divider.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const workspace = document.querySelector('.workspace');
  const totalWidth = workspace.getBoundingClientRect().width;
  const delta = e.clientX - dragStartX;
  const newEditorWidth = editorStartWidth + delta;
  const minWidth = totalWidth * 0.2;
  const maxWidth = totalWidth * 0.8;
  const clamped = Math.max(minWidth, Math.min(maxWidth, newEditorWidth));
  const editorPct = (clamped / totalWidth) * 100;
  paneEditor.style.flex = `0 0 ${editorPct}%`;
  panePreview.style.flex = `0 0 ${100 - editorPct}%`;
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  divider.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

// ── Init ──────────────────────────────────────

(function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const content = saved !== null ? saved : DEFAULT_CONTENT;
  editor.value = content;
  render(content);
  updateStats(content);
})();
