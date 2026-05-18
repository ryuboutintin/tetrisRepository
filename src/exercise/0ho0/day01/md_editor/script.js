const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const workspace = document.querySelector("#workspace");
const wordCount = document.querySelector("#wordCount");
const saveState = document.querySelector("#saveState");
const fileInput = document.querySelector("#fileInput");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const storageKey = "easy-markdown-editor-content-codex-install";

const starterText = `# Codex 설치 방법

Codex CLI는 OpenAI의 코딩 에이전트입니다. 터미널에서 실행하며, 프로젝트 폴더 안에서 코드 작성, 수정, 설명, 리뷰 같은 작업을 도와줍니다.

## 1. 준비하기

- Node.js와 npm이 설치되어 있는지 확인합니다.
- macOS라면 Homebrew를 사용할 수도 있습니다.
- ChatGPT 계정 또는 OpenAI API 키를 준비합니다.

## 2. npm으로 설치하기

\`\`\`bash
npm install -g @openai/codex
\`\`\`

설치가 끝나면 아래 명령어로 Codex를 실행합니다.

\`\`\`bash
codex
\`\`\`

## 3. macOS에서 Homebrew로 설치하기

\`\`\`bash
brew install --cask codex
\`\`\`

설치 후 동일하게 실행합니다.

\`\`\`bash
codex
\`\`\`

## 4. 로그인하기

Codex를 처음 실행하면 로그인 방식을 선택합니다.

- ChatGPT 요금제를 사용한다면 **Sign in with ChatGPT**를 선택합니다.
- API 키를 사용할 경우 OpenAI API 키 설정을 진행합니다.

## 5. 프로젝트에서 사용하기

작업할 프로젝트 폴더로 이동한 뒤 Codex를 실행합니다.

\`\`\`bash
cd my-project
codex
\`\`\`

예시로 이런 요청을 할 수 있습니다.

- "이 프로젝트 구조를 설명해줘"
- "로그인 페이지 UI를 개선해줘"
- "테스트가 실패하는 이유를 찾아줘"
- "변경한 코드를 리뷰해줘"

## 6. 설치 확인

\`\`\`bash
codex --version
\`\`\`

버전이 표시되면 설치가 완료된 것입니다.

---

공식 문서: [openai/codex GitHub 저장소](https://github.com/openai/codex)
`;

editor.value = localStorage.getItem(storageKey) || starterText;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderTable(rows) {
  const header = rows[0].split("|").filter(Boolean).map((cell) => `<th>${renderInline(cell.trim())}</th>`).join("");
  const body = rows.slice(2).map((row) => {
    const cells = row.split("|").filter(Boolean).map((cell) => `<td>${renderInline(cell.trim())}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let code = [];
  let inCode = false;
  let table = [];

  const closeParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  const closeQuote = () => {
    if (quote.length) {
      html.push(`<blockquote>${quote.map((line) => `<p>${renderInline(line)}</p>`).join("")}</blockquote>`);
      quote = [];
    }
  };

  const closeTable = () => {
    if (table.length) {
      html.push(renderTable(table));
      table = [];
    }
  };

  const closeBlocks = () => {
    closeParagraph();
    closeList();
    closeQuote();
    closeTable();
  };

  lines.forEach((line) => {
    if (line.startsWith("```")) {
      closeBlocks();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
      }
      inCode = !inCode;
      return;
    }

    if (inCode) {
      code.push(line);
      return;
    }

    if (/^\|(.+\|)+$/.test(line)) {
      closeParagraph();
      closeList();
      closeQuote();
      table.push(line);
      return;
    }

    closeTable();

    if (!line.trim()) {
      closeBlocks();
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      return;
    }

    if (/^---+$/.test(line.trim())) {
      closeBlocks();
      html.push("<hr>");
      return;
    }

    if (line.startsWith("> ")) {
      closeParagraph();
      closeList();
      quote.push(line.slice(2));
      return;
    }

    const checklist = line.match(/^- \[( |x)\]\s+(.+)$/i);
    if (checklist) {
      closeParagraph();
      closeQuote();
      if (list !== "ul") {
        closeList();
        html.push("<ul>");
        list = "ul";
      }
      const checked = checklist[1].toLowerCase() === "x" ? " checked" : "";
      html.push(`<li><input type="checkbox" disabled${checked}> ${renderInline(checklist[2])}</li>`);
      return;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      closeParagraph();
      closeQuote();
      if (list !== "ul") {
        closeList();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${renderInline(unordered[1])}</li>`);
      return;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      closeParagraph();
      closeQuote();
      if (list !== "ol") {
        closeList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${renderInline(ordered[1])}</li>`);
      return;
    }

    closeList();
    closeQuote();
    paragraph.push(line.trim());
  });

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  }
  closeBlocks();

  return html.join("");
}

function update() {
  const text = editor.value;
  preview.innerHTML = markdownToHtml(text);
  wordCount.textContent = `${text.length.toLocaleString("ko-KR")}자`;
  localStorage.setItem(storageKey, text);
  saveState.textContent = "자동 저장됨";
}

function insertMarkdown(type) {
  const snippets = {
    heading: { before: "# ", after: "", fallback: "제목" },
    heading2: { before: "## ", after: "", fallback: "중간 제목" },
    heading3: { before: "### ", after: "", fallback: "작은 제목" },
    bold: { before: "**", after: "**", fallback: "굵은 글씨" },
    italic: { before: "*", after: "*", fallback: "기울임 글씨" },
    strike: { before: "~~", after: "~~", fallback: "취소선" },
    inlineCode: { before: "`", after: "`", fallback: "코드" },
    quote: { before: "> ", after: "", fallback: "인용문" },
    list: { before: "- ", after: "", fallback: "목록" },
    orderedList: { before: "1. ", after: "", fallback: "번호 목록" },
    check: { before: "- [ ] ", after: "", fallback: "체크할 일" },
    link: { before: "[", after: "](https://example.com)", fallback: "링크 텍스트" },
    image: { before: "![", after: "](https://example.com/image.jpg)", fallback: "이미지 설명" },
    code: { before: "```\n", after: "\n```", fallback: "코드 입력" },
    table: { before: "| 항목 | 내용 |\n| --- | --- |\n| 이름 | 설명 |\n", after: "", fallback: "" },
    divider: { before: "\n---\n", after: "", fallback: "" },
  };
  const { before, after, fallback } = snippets[type];
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end) || fallback;
  editor.setRangeText(`${before}${selected}${after}`, start, end, "select");
  editor.focus();
  update();
}

document.querySelectorAll("[data-insert]").forEach((button) => {
  button.addEventListener("click", () => insertMarkdown(button.dataset.insert));
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    workspace.className = `workspace ${button.dataset.mode}`;
  });
});

editor.addEventListener("input", () => {
  saveState.textContent = "저장 중...";
  update();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    editor.value = reader.result;
    update();
  });
  reader.readAsText(file);
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(editor.value);
    saveState.textContent = "복사됨";
  } catch {
    editor.focus();
    editor.select();
    document.execCommand("copy");
    saveState.textContent = "복사됨";
  }
});

downloadButton.addEventListener("click", () => {
  const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "document.md";
  link.click();
  URL.revokeObjectURL(url);
});

update();
