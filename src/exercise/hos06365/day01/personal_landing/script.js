const input = document.querySelector("#markdownInput");
const preview = document.querySelector("#preview");
const counterText = document.querySelector("#counterText");
const statusText = document.querySelector("#statusText");
const saveBtn = document.querySelector("#saveBtn");
const clearBtn = document.querySelector("#clearBtn");
const toolbar = document.querySelector(".format-buttons");

const STORAGE_KEY = "practice-markdown-editor";
const sampleMarkdown = `# 마크다운 에디터

왼쪽에 **마크다운**을 입력하면 오른쪽에서 HTML 미리보기를 확인할 수 있습니다.

## 지원 문법

- 제목: #, ##, ###
- 굵게, 기울임, 인라인 코드
- 링크와 이미지
- 인용문
- 코드 블록

> 저장 버튼을 누르면 브라우저 localStorage에 내용이 저장됩니다.

\`\`\`js
console.log("Markdown preview ready");
\`\`\`
`;

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseInline(text) {
  let html = escapeHtml(text);

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function closeList(state, html) {
  if (!state.listType) {
    return;
  }

  html.push(`</${state.listType}>`);
  state.listType = "";
}

function parseMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  const state = {
    listType: "",
    inCodeBlock: false,
    codeLines: []
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      closeList(state, html);

      if (state.inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`);
        state.codeLines = [];
        state.inCodeBlock = false;
      } else {
        state.inCodeBlock = true;
      }
      return;
    }

    if (state.inCodeBlock) {
      state.codeLines.push(line);
      return;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      closeList(state, html);
      return;
    }

    if (/^---+$/.test(trimmed)) {
      closeList(state, html);
      html.push("<hr>");
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList(state, html);
      const level = heading[1].length;
      html.push(`<h${level}>${parseInline(heading[2])}</h${level}>`);
      return;
    }

    if (trimmed.startsWith("> ")) {
      closeList(state, html);
      html.push(`<blockquote>${parseInline(trimmed.slice(2))}</blockquote>`);
      return;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);

    if (unordered || ordered) {
      const nextType = unordered ? "ul" : "ol";
      if (state.listType !== nextType) {
        closeList(state, html);
        html.push(`<${nextType}>`);
        state.listType = nextType;
      }
      html.push(`<li>${parseInline((unordered || ordered)[1])}</li>`);
      return;
    }

    closeList(state, html);
    html.push(`<p>${parseInline(trimmed)}</p>`);
  });

  if (state.inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`);
  }
  closeList(state, html);

  return html.join("\n");
}

function updateCounter(markdown) {
  const characters = markdown.length;
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  counterText.textContent = `${characters} 글자 · ${words} 단어`;
}

function render() {
  const markdown = input.value;
  preview.innerHTML = parseMarkdown(markdown);
  updateCounter(markdown);
  localStorage.setItem(STORAGE_KEY, markdown);
  statusText.textContent = "자동 저장됨";
}

function wrapSelection(before, after = before) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const selected = input.value.slice(start, end);
  const nextText = `${before}${selected || "텍스트"}${after}`;

  input.setRangeText(nextText, start, end, "select");
  input.focus();
  render();
}

function prefixSelection(prefix) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const selected = input.value.slice(start, end) || "텍스트";
  const nextText = selected
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");

  input.setRangeText(nextText, start, end, "select");
  input.focus();
  render();
}

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.dataset.wrap) {
    wrapSelection(button.dataset.wrap);
    return;
  }

  if (button.dataset.prefix) {
    prefixSelection(button.dataset.prefix);
    return;
  }

  if (button.dataset.link !== undefined) {
    wrapSelection("[", "](https://example.com)");
  }
});

input.addEventListener("input", render);

saveBtn.addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY, input.value);
  statusText.textContent = "저장 완료";
});

clearBtn.addEventListener("click", () => {
  const shouldClear = window.confirm("작성 중인 내용을 초기화할까요?");
  if (!shouldClear) {
    return;
  }

  input.value = "";
  render();
  statusText.textContent = "초기화됨";
});

input.value = localStorage.getItem(STORAGE_KEY) || sampleMarkdown;
render();
