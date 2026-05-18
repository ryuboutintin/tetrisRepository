const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const workspace = document.querySelector("#workspace");
const saveStatus = document.querySelector("#saveStatus");
const docStats = document.querySelector("#docStats");
const lineCount = document.querySelector("#lineCount");
const toast = document.querySelector("#toast");
const storageKey = "plain-markdown-editor-content";

const starter = `# 새 문서

마크다운을 입력하면 오른쪽에서 바로 미리볼 수 있습니다.

## 지원 문법

- **굵게**, *기울임*, \`코드\`
- [링크](https://example.com)
- 인용문과 코드 블록
- 표

> 작성 내용은 브라우저에 자동 저장됩니다.

\`\`\`js
const message = "Hello Markdown";
console.log(message);
\`\`\`

| 항목 | 상태 |
| --- | --- |
| 편집기 | 준비됨 |
| 미리보기 | 준비됨 |
`;

editor.value = localStorage.getItem(storageKey) || starter;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

function isTableStart(lines, index) {
  return Boolean(
    lines[index] &&
      lines[index + 1] &&
      lines[index].includes("|") &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function renderTable(rows) {
  const cells = rows.map((row) =>
    row
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => inlineMarkdown(cell.trim()))
  );
  const head = cells[0] || [];
  const body = cells.slice(2);

  return `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let code = null;

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list) {
      html.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
      list = null;
    }
  }

  function flushQuote() {
    if (quote.length) {
      html.push(`<blockquote>${quote.map((line) => `<p>${inlineMarkdown(line)}</p>`).join("")}</blockquote>`);
      quote = [];
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (code) {
      if (/^```/.test(line)) {
        html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }

    if (/^```/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      code = { lines: [] };
      continue;
    }

    if (isTableStart(lines, i)) {
      flushParagraph();
      flushList();
      flushQuote();
      const rows = [lines[i], lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(lines[i]);
        i += 1;
      }
      i -= 1;
      html.push(renderTable(rows));
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
      flushQuote();
      html.push("<hr>");
      continue;
    }

    const quoteMatch = /^>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quote.push(quoteMatch[1]);
      continue;
    }

    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const type = unordered ? "ul" : "ol";
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (code) html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
  flushParagraph();
  flushList();
  flushQuote();
  return html.join("\n");
}

function updateStats() {
  const text = editor.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split("\n").length : 1;
  docStats.textContent = `${text.length.toLocaleString()} 글자 · ${words.toLocaleString()} 단어`;
  lineCount.textContent = `${lines.toLocaleString()} 줄`;
}

function render() {
  preview.innerHTML = markdownToHtml(editor.value);
  updateStats();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

function save() {
  localStorage.setItem(storageKey, editor.value);
  saveStatus.textContent = `자동 저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

function applyFormat(button) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end);
  let replacement = "";
  let cursorStart = start;
  let cursorEnd = end;

  if (button.dataset.wrap) {
    const [before, after] = button.dataset.wrap.split("|");
    replacement = `${before}${selected || "텍스트"}${after}`;
    cursorStart = start + before.length;
    cursorEnd = cursorStart + (selected || "텍스트").length;
  }

  if (button.dataset.prefix) {
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    editor.setRangeText(button.dataset.prefix, lineStart, lineStart, "end");
    editor.focus();
    render();
    save();
    return;
  }

  if (button.dataset.insert) {
    replacement = button.dataset.insert;
    cursorStart = start;
    cursorEnd = start + replacement.length;
  }

  editor.setRangeText(replacement, start, end, "select");
  editor.setSelectionRange(cursorStart, cursorEnd);
  editor.focus();
  render();
  save();
}

document.querySelectorAll("[data-wrap], [data-prefix], [data-insert]").forEach((button) => {
  button.addEventListener("click", () => applyFormat(button));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    workspace.classList.remove("editor-only", "preview-only");
    if (button.dataset.view === "editor") workspace.classList.add("editor-only");
    if (button.dataset.view === "preview") workspace.classList.add("preview-only");
  });
});

document.querySelector("#copyHtml").addEventListener("click", async () => {
  const html = preview.innerHTML;
  try {
    await navigator.clipboard.writeText(html);
    showToast("HTML이 클립보드에 복사되었습니다.");
  } catch {
    showToast("브라우저에서 클립보드 복사를 허용하지 않았습니다.");
  }
});

document.querySelector("#downloadMd").addEventListener("click", () => {
  const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "document.md";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#clearDoc").addEventListener("click", () => {
  if (!window.confirm("문서를 모두 비울까요?")) return;
  editor.value = "";
  render();
  save();
  editor.focus();
});

editor.addEventListener("input", () => {
  render();
  save();
});

editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
    render();
    save();
  }
});

render();
