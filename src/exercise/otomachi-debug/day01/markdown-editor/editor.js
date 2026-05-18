/* ── Markdown Parser ──────────────────────────── */
function parseMarkdown(md) {
  let html = md
    // escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // fenced code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang}">${code.trimEnd()}</code></pre>`;
  });

  // headings
  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // blockquote (multi-line)
  html = html.replace(/(^&gt; .+(\n&gt; .+)*)/gm, (block) => {
    const inner = block.replace(/^&gt; /gm, "");
    return `<blockquote>${inner}</blockquote>`;
  });

  // hr
  html = html.replace(/^(---|\*\*\*|___)\s*$/gm, "<hr>");

  // unordered list
  html = html.replace(/(^[*\-+] .+(\n[*\-+] .+)*)/gm, (block) => {
    const items = block
      .split("\n")
      .map((l) => `<li>${l.replace(/^[*\-+] /, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // ordered list
  html = html.replace(/(^\d+\. .+(\n\d+\. .+)*)/gm, (block) => {
    const items = block
      .split("\n")
      .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // images before links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // inline formatting (applied after block-level)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // paragraphs: wrap bare lines not inside block elements
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|img)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

/* ── Elements ─────────────────────────────────── */
const editor      = document.getElementById("editor");
const preview     = document.getElementById("preview");
const workspace   = document.getElementById("workspace");
const charCount   = document.getElementById("char-count");
const lineCount   = document.getElementById("line-count");
const wordCount   = document.getElementById("word-count");
const toggleSync  = document.getElementById("toggle-sync");
const toast       = document.getElementById("toast");

/* ── Default content ──────────────────────────── */
const DEFAULT_MD = `# 마크다운 에디터에 오신 것을 환영합니다!

## 기능 소개

왼쪽에서 **마크다운**을 입력하면 오른쪽에 **실시간 미리보기**가 표시됩니다.

### 지원하는 문법

**굵게**, *기울임*, ~~취소선~~, \`인라인 코드\`

> 인용문도 지원합니다. 멋지죠?

---

### 목록

- 항목 하나
- 항목 둘
- 항목 셋

1. 첫 번째
2. 두 번째
3. 세 번째

### 코드 블록

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet("World"));
\`\`\`

### 링크

[Anthropic](https://www.anthropic.com) · [GitHub](https://github.com)

---

*상단 툴바나 단축키로 편리하게 서식을 적용해보세요!*
`;

/* ── Render ───────────────────────────────────── */
function render() {
  preview.innerHTML = parseMarkdown(editor.value);
  updateStats();
  localStorage.setItem("md-editor-content", editor.value);
}

function updateStats() {
  const text = editor.value;
  charCount.textContent = `${text.length}자`;
  lineCount.textContent = `${text.split("\n").length}줄`;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  wordCount.textContent = `${words}단어`;
}

/* ── Load saved / default ─────────────────────── */
editor.value = localStorage.getItem("md-editor-content") ?? DEFAULT_MD;
render();

/* ── Live update ──────────────────────────────── */
editor.addEventListener("input", render);

/* ── Synchronized scroll ──────────────────────── */
let syncLock = false;

editor.addEventListener("scroll", () => {
  if (!toggleSync.checked || syncLock) return;
  syncLock = true;
  const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
  preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  requestAnimationFrame(() => { syncLock = false; });
});

preview.addEventListener("scroll", () => {
  if (!toggleSync.checked || syncLock) return;
  syncLock = true;
  const ratio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
  editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
  requestAnimationFrame(() => { syncLock = false; });
});

/* ── Toast helper ─────────────────────────────── */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ── Toolbar actions ──────────────────────────── */
const SNIPPETS = {
  bold:         { wrap: "**",  placeholder: "굵은 텍스트" },
  italic:       { wrap: "*",   placeholder: "기울임 텍스트" },
  strikethrough:{ wrap: "~~",  placeholder: "취소선 텍스트" },
  code:         { wrap: "`",   placeholder: "코드" },
  h1:           { prefix: "# " },
  h2:           { prefix: "## " },
  h3:           { prefix: "### " },
  ul:           { prefix: "- " },
  ol:           { prefix: "1. " },
  quote:        { prefix: "> " },
  hr:           { block: "\n---\n" },
  codeblock:    { block: "```\n코드를 입력하세요\n```" },
  link:         { block: "[링크 텍스트](https://example.com)" },
};

function applyAction(action) {
  const s = SNIPPETS[action];
  if (!s) return;

  const start = editor.selectionStart;
  const end   = editor.selectionEnd;
  const sel   = editor.value.slice(start, end);
  const before = editor.value.slice(0, start);
  const after  = editor.value.slice(end);

  let insert, cursorStart, cursorEnd;

  if (s.wrap) {
    const content = sel || s.placeholder;
    insert = s.wrap + content + s.wrap;
    cursorStart = start + s.wrap.length;
    cursorEnd   = cursorStart + content.length;
  } else if (s.prefix) {
    const lineStart = before.lastIndexOf("\n") + 1;
    const linePrefix = editor.value.slice(lineStart, start);
    if (linePrefix.startsWith(s.prefix)) {
      // toggle off
      editor.value = editor.value.slice(0, lineStart) + linePrefix.slice(s.prefix.length) + editor.value.slice(lineStart + linePrefix.length);
    } else {
      editor.value = editor.value.slice(0, lineStart) + s.prefix + editor.value.slice(lineStart);
      editor.setSelectionRange(start + s.prefix.length, end + s.prefix.length);
    }
    render();
    editor.focus();
    return;
  } else if (s.block) {
    insert = s.block;
    cursorStart = start + insert.length;
    cursorEnd   = cursorStart;
  }

  editor.value = before + insert + after;
  editor.setSelectionRange(cursorStart, cursorEnd);
  render();
  editor.focus();
}

document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => applyAction(btn.dataset.action));
});

/* ── Keyboard shortcuts ───────────────────────── */
editor.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    const map = { b: "bold", i: "italic", k: "link" };
    if (map[e.key]) { e.preventDefault(); applyAction(map[e.key]); }
  }

  // Tab → indent
  if (e.key === "Tab") {
    e.preventDefault();
    const s = editor.selectionStart;
    editor.value = editor.value.slice(0, s) + "  " + editor.value.slice(editor.selectionEnd);
    editor.setSelectionRange(s + 2, s + 2);
    render();
  }
});

/* ── View mode buttons ────────────────────────── */
const viewBtns = {
  "btn-split":   "",
  "btn-editor":  "editor-only",
  "btn-preview": "preview-only",
};

Object.entries(viewBtns).forEach(([id, cls]) => {
  document.getElementById(id).addEventListener("click", () => {
    workspace.className = "workspace" + (cls ? " " + cls : "");
    document.querySelectorAll(".view-btn").forEach((b) => b.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  });
});

/* ── Header buttons ───────────────────────────── */
document.getElementById("btn-clear").addEventListener("click", () => {
  if (!editor.value || confirm("내용을 모두 지우시겠습니까?")) {
    editor.value = "";
    render();
    showToast("내용이 지워졌습니다.");
  }
});

document.getElementById("btn-copy").addEventListener("click", () => {
  navigator.clipboard.writeText(preview.innerHTML)
    .then(() => showToast("HTML이 클립보드에 복사되었습니다."))
    .catch(() => showToast("복사에 실패했습니다."));
});

document.getElementById("btn-download").addEventListener("click", () => {
  const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "document.md";
  a.click();
  URL.revokeObjectURL(url);
  showToast("파일이 다운로드되었습니다.");
});

/* ── Resizer (drag to resize panes) ───────────── */
const resizer    = document.getElementById("resizer");
const editorPane = document.getElementById("editor-pane");

let isResizing = false;

resizer.addEventListener("mousedown", (e) => {
  isResizing = true;
  resizer.classList.add("dragging");
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
});

document.addEventListener("mousemove", (e) => {
  if (!isResizing) return;
  const workspaceRect = workspace.getBoundingClientRect();
  const offset = e.clientX - workspaceRect.left;
  const total  = workspaceRect.width - 4; // minus resizer width
  const pct    = Math.min(80, Math.max(20, (offset / total) * 100));
  editorPane.style.flex = "none";
  editorPane.style.width = `${pct}%`;
});

document.addEventListener("mouseup", () => {
  if (!isResizing) return;
  isResizing = false;
  resizer.classList.remove("dragging");
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
});
