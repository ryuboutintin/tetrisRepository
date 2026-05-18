// ── Markdown Parser ─────────────────────────────────────────────────────────
const marked = (() => {
  function escape(html) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseInline(src) {
    let out = '';
    while (src) {
      let m;
      // Bold **text**
      m = src.match(/^\*\*(.+?)\*\*/s);
      if (m) { out += `<strong>${parseInline(m[1])}</strong>`; src = src.slice(m[0].length); continue; }
      // Bold __text__
      m = src.match(/^__(.+?)__/s);
      if (m) { out += `<strong>${parseInline(m[1])}</strong>`; src = src.slice(m[0].length); continue; }
      // Italic *text*
      m = src.match(/^\*([^*\n]+?)\*/);
      if (m) { out += `<em>${parseInline(m[1])}</em>`; src = src.slice(m[0].length); continue; }
      // Italic _text_
      m = src.match(/^_([^_\n]+?)_/);
      if (m) { out += `<em>${parseInline(m[1])}</em>`; src = src.slice(m[0].length); continue; }
      // Strikethrough ~~text~~
      m = src.match(/^~~(.+?)~~/s);
      if (m) { out += `<del>${parseInline(m[1])}</del>`; src = src.slice(m[0].length); continue; }
      // Inline code `code`
      m = src.match(/^`([^`]+)`/);
      if (m) { out += `<code>${escape(m[1])}</code>`; src = src.slice(m[0].length); continue; }
      // Image ![alt](url)  — must come before link
      m = src.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (m) { out += `<img src="${escape(m[2])}" alt="${escape(m[1])}" />`; src = src.slice(m[0].length); continue; }
      // Link [text](url)
      m = src.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (m) { out += `<a href="${escape(m[2])}" target="_blank" rel="noopener">${parseInline(m[1])}</a>`; src = src.slice(m[0].length); continue; }
      // Bare URL
      m = src.match(/^https?:\/\/[^\s<>)]+/);
      if (m) { out += `<a href="${escape(m[0])}" target="_blank" rel="noopener">${escape(m[0])}</a>`; src = src.slice(m[0].length); continue; }

      out += escape(src[0]);
      src = src.slice(1);
    }
    return out;
  }

  function parseBlock(lines) {
    let out = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block ```lang
      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        let code = '';
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + '\n'; i++; }
        i++;
        out += `<pre><code class="language-${escape(lang)}">${escape(code.trimEnd())}</code></pre>\n`;
        continue;
      }
      // Headings #~######
      let m = line.match(/^(#{1,6})\s+(.+)/);
      if (m) { const lvl = m[1].length; out += `<h${lvl}>${parseInline(m[2])}</h${lvl}>\n`; i++; continue; }
      // Horizontal rule
      if (/^(---+|===+|\*\*\*+)\s*$/.test(line)) { out += '<hr/>\n'; i++; continue; }
      // Blockquote
      if (/^>\s?/.test(line)) {
        let bq = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { bq.push(lines[i].replace(/^>\s?/, '')); i++; }
        out += `<blockquote>${parseBlock(bq)}</blockquote>\n`;
        continue;
      }
      // Table  (header | --- | row)
      if (i + 1 < lines.length && /^\|?[\s:|-]+[\|[\s:|-]+]*$/.test(lines[i + 1]) && /\|/.test(line)) {
        const headers = line.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
        i += 2;
        let rows = [];
        while (i < lines.length && /\|/.test(lines[i])) {
          rows.push(lines[i].replace(/^\||\|$/g, '').split('|').map(s => s.trim()));
          i++;
        }
        out += '<table><thead><tr>' + headers.map(h => `<th>${parseInline(h)}</th>`).join('') + '</tr></thead><tbody>';
        rows.forEach(r => { out += '<tr>' + r.map(c => `<td>${parseInline(c)}</td>`).join('') + '</tr>'; });
        out += '</tbody></table>\n';
        continue;
      }
      // Unordered list  - / * / +
      if (/^[-*+] /.test(line)) {
        let items = [];
        while (i < lines.length && /^[-*+] /.test(lines[i])) { items.push(lines[i].replace(/^[-*+] /, '')); i++; }
        out += '<ul>' + items.map(it => {
          if (/^\[[ xX]\] /.test(it)) {
            const checked = /^\[[xX]\]/.test(it);
            return `<li class="task-list-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled/> ${parseInline(it.slice(4))}</li>`;
          }
          return `<li>${parseInline(it)}</li>`;
        }).join('') + '</ul>\n';
        continue;
      }
      // Ordered list  1. 2. …
      if (/^\d+\. /.test(line)) {
        let items = [];
        while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
        out += '<ol>' + items.map(it => `<li>${parseInline(it)}</li>`).join('') + '</ol>\n';
        continue;
      }
      // Empty line — paragraph separator
      if (line.trim() === '') { i++; continue; }
      // Paragraph — collect consecutive plain lines
      let para = [];
      const SPECIAL = /^(#{1,6}\s|>|```|[-*+] |\d+\. |---+|===+|\*\*\*+)/;
      while (i < lines.length && lines[i].trim() !== '' && !SPECIAL.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      if (para.length) out += `<p>${para.map(parseInline).join('<br/>')}</p>\n`;
    }
    return out;
  }

  return { parse: src => parseBlock(src.split('\n')) };
})();

// ── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'md-editor-content';
const AUTOSAVE_DELAY = 600; // ms debounce

// ── DOM refs ─────────────────────────────────────────────────────────────────
const editorEl   = document.getElementById('editor');
const previewEl  = document.getElementById('preview');
const saveBadge  = document.getElementById('saveBadge');
const statWords  = document.getElementById('statWords');
const statChars  = document.getElementById('statChars');
const statLines  = document.getElementById('statLines');
const statCursor = document.getElementById('statCursor');
const statSaved  = document.getElementById('statSaved');
const editorWrap = document.getElementById('editorWrap');
const toastEl    = document.getElementById('toast');

// ── Default content ───────────────────────────────────────────────────────────
const DEFAULT_CONTENT = `# Markdown Editor에 오신 것을 환영합니다!

> 왼쪽에 작성하면 오른쪽에서 실시간으로 미리보기가 됩니다.
> 내용은 **자동으로 저장**됩니다.

## 기본 문법

**굵게**, *기울임*, ~~취소선~~, \`인라인 코드\`

## 목록

- 항목 하나
- 항목 둘

1. 첫 번째
2. 두 번째

## 체크리스트

- [x] 완료된 작업
- [ ] 남은 작업

## 코드 블록

\`\`\`javascript
const hello = () => {
  console.log("Hello, Markdown!");
};
\`\`\`

## 테이블

| 이름 | 역할 | 상태 |
|------|------|------|
| Alice | 개발자 | ✅ |
| Bob | 디자이너 | 🚀 |

## 인용구

> 좋은 코드는 그 자체가 문서다.
> — Robert C. Martin

---

[GitHub](https://github.com) | **즐거운 글쓰기 되세요!**
`;

// ── LocalStorage ──────────────────────────────────────────────────────────────
let autoSaveTimer = null;
let currentFile = null;

function loadFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  editorEl.value = saved !== null ? saved : DEFAULT_CONTENT;
  const ts = localStorage.getItem(STORAGE_KEY + '-ts');
  if (ts) updateSavedTime(Number(ts));
}

function saveToStorage() {
  const now = Date.now();
  localStorage.setItem(STORAGE_KEY, editorEl.value);
  localStorage.setItem(STORAGE_KEY + '-ts', String(now));
  updateSavedTime(now);
  setSaveBadge('saved');
}

function scheduleAutoSave() {
  setSaveBadge('saving');
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(saveToStorage, AUTOSAVE_DELAY);
}

function updateSavedTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  statSaved.textContent = `자동저장 ${timeStr}`;
}

function setSaveBadge(state) {
  if (state === 'saving') {
    saveBadge.textContent = '저장 중…';
    saveBadge.classList.add('saving');
  } else {
    saveBadge.textContent = '저장됨';
    saveBadge.classList.remove('saving');
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  previewEl.innerHTML = marked.parse(editorEl.value);
  updateStats();
}

function updateStats() {
  const text = editorEl.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  statWords.textContent  = `단어 ${words}`;
  statChars.textContent  = `글자 ${text.length}`;
  statLines.textContent  = `줄 ${text.split('\n').length}`;
}

function updateCursor() {
  const pos = editorEl.selectionStart;
  const before = editorEl.value.substring(0, pos);
  const line = before.split('\n').length;
  const col  = before.split('\n').pop().length + 1;
  statCursor.textContent = `${line}:${col}`;
}

// ── Editor events ─────────────────────────────────────────────────────────────
editorEl.addEventListener('input', () => {
  render();
  scheduleAutoSave();
});

editorEl.addEventListener('keyup', updateCursor);
editorEl.addEventListener('click', updateCursor);

editorEl.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    insertAt('  ');
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    const shortcuts = {
      b: () => wrapSel('**', '**'),
      i: () => wrapSel('*', '*'),
      s: () => { e.preventDefault(); downloadMd(); },
    };
    if (shortcuts[e.key]) { e.preventDefault(); shortcuts[e.key](); }
  }
});

// ── Text helpers ──────────────────────────────────────────────────────────────
function insertAt(text) {
  const s = editorEl.selectionStart;
  const e = editorEl.selectionEnd;
  editorEl.value = editorEl.value.substring(0, s) + text + editorEl.value.substring(e);
  editorEl.selectionStart = editorEl.selectionEnd = s + text.length;
  editorEl.focus();
  render();
  scheduleAutoSave();
}

function wrapSel(before, after, placeholder = '텍스트') {
  const s   = editorEl.selectionStart;
  const e   = editorEl.selectionEnd;
  const sel = editorEl.value.substring(s, e) || placeholder;
  const replacement = before + sel + after;
  editorEl.value = editorEl.value.substring(0, s) + replacement + editorEl.value.substring(e);
  editorEl.selectionStart = s + before.length;
  editorEl.selectionEnd   = s + before.length + sel.length;
  editorEl.focus();
  render();
  scheduleAutoSave();
}

function prependLine(prefix) {
  const s = editorEl.selectionStart;
  const before = editorEl.value.substring(0, s);
  const lineStart = before.lastIndexOf('\n') + 1;
  const rest = editorEl.value.substring(lineStart);
  if (rest.startsWith(prefix)) {
    editorEl.value = editorEl.value.substring(0, lineStart) + rest.substring(prefix.length);
    editorEl.selectionStart = editorEl.selectionEnd = Math.max(lineStart, s - prefix.length);
  } else {
    editorEl.value = editorEl.value.substring(0, lineStart) + prefix + rest;
    editorEl.selectionStart = editorEl.selectionEnd = s + prefix.length;
  }
  editorEl.focus();
  render();
  scheduleAutoSave();
}

// ── Toolbar wiring ────────────────────────────────────────────────────────────
const toolbarActions = {
  tbBold:      () => wrapSel('**', '**'),
  tbItalic:    () => wrapSel('*', '*'),
  tbStrike:    () => wrapSel('~~', '~~'),
  tbH1:        () => prependLine('# '),
  tbH2:        () => prependLine('## '),
  tbH3:        () => prependLine('### '),
  tbUl:        () => prependLine('- '),
  tbOl:        () => prependLine('1. '),
  tbTask:      () => prependLine('- [ ] '),
  tbQuote:     () => prependLine('> '),
  tbCode:      () => wrapSel('`', '`', 'code'),
  tbCodeBlock: () => insertAt('\n```\n코드를 입력하세요\n```\n'),
  tbHr:        () => insertAt('\n---\n'),
  tbTable:     () => insertAt('\n| 열1 | 열2 | 열3 |\n|-----|-----|-----|\n| 값1 | 값2 | 값3 |\n'),
  tbLink: () => {
    const url = prompt('URL을 입력하세요:', 'https://');
    if (url) wrapSel('[', `](${url})`, '링크 텍스트');
  },
  tbImg: () => {
    const url = prompt('이미지 URL을 입력하세요:', 'https://');
    if (url) insertAt(`![이미지](${url})`);
  },
  tbUndo: () => { document.execCommand('undo'); render(); },
  tbRedo: () => { document.execCommand('redo'); render(); },
};

Object.entries(toolbarActions).forEach(([id, fn]) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
});

// ── View toggle ───────────────────────────────────────────────────────────────
document.querySelector('.view-toggle').addEventListener('click', e => {
  const btn = e.target.closest('.vt-btn');
  if (!btn) return;
  document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  editorWrap.className = 'editor-wrap view-' + btn.dataset.view;
});

// ── File open ─────────────────────────────────────────────────────────────────
document.getElementById('btnOpen').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  currentFile = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    editorEl.value = ev.target.result;
    render();
    saveToStorage();
    toast(`파일 열기: ${file.name}`);
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── Download .md ──────────────────────────────────────────────────────────────
function downloadMd() {
  const blob = new Blob([editorEl.value], { type: 'text/markdown' });
  triggerDownload(blob, currentFile || 'document.md');
  toast('마크다운 파일로 저장했습니다.');
}

document.getElementById('btnSave').addEventListener('click', downloadMd);

// ── Export HTML ───────────────────────────────────────────────────────────────
document.getElementById('btnExport').addEventListener('click', () => {
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Exported Document</title>
  <style>
    body { max-width: 760px; margin: 40px auto; font-family: system-ui, sans-serif; line-height: 1.7; color: #222; padding: 0 20px; }
    h1, h2, h3 { margin-top: 1.5em; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: .3em; }
    h2 { border-bottom: 1px solid #eee; padding-bottom: .2em; }
    pre { background: #f6f8fa; padding: 14px; border-radius: 6px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: .9em; }
    pre code { background: transparent; padding: 0; }
    blockquote { border-left: 3px solid #ccc; margin: 0; padding: 4px 16px; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ddd; padding: 8px 12px; }
    th { background: #f8f8f8; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
  </style>
</head>
<body>
${previewEl.innerHTML}
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const name = (currentFile || 'document').replace(/\.md$/, '') + '.html';
  triggerDownload(blob, name);
  toast('HTML 파일로 내보냈습니다.');
});

// ── Clear (with confirm dialog) ───────────────────────────────────────────────
document.getElementById('btnClear').addEventListener('click', () => {
  document.getElementById('confirmDialog').classList.add('open');
});

document.getElementById('confirmCancel').addEventListener('click', () => {
  document.getElementById('confirmDialog').classList.remove('open');
});

document.getElementById('confirmOk').addEventListener('click', () => {
  editorEl.value = '';
  currentFile = null;
  render();
  saveToStorage();
  document.getElementById('confirmDialog').classList.remove('open');
  toast('내용을 초기화했습니다.');
});

// ── Util ──────────────────────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadFromStorage();
render();
setSaveBadge('saved');
