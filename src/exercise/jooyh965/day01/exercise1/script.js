const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");

const STORAGE_KEY = "markdown-editor-content";

const DEFAULT_CONTENT = `# Markdown Editor 📝

**HTML + JavaScript**로 만든 마크다운 에디터입니다.

## 주요 기능

- 좌측 입력 / 우측 **실시간 미리보기**
- 툴바로 빠른 마크다운 삽입
- \`localStorage\` 자동 저장
- \`.md\` 파일로 다운로드

## 마크다운 예시

### 텍스트 스타일

**굵게**, *기울임*, ~~취소선~~, \`인라인 코드\`

### 목록

- 항목 1
- 항목 2
  - 하위 항목
- 항목 3

1. 순서 1
2. 순서 2
3. 순서 3

### 인용

> 단순함이 궁극의 정교함이다. — 레오나르도 다 빈치

### 코드 블록

\`\`\`javascript
function hello(name) {
    return \`Hello, \${name}!\`;
}
console.log(hello("World"));
\`\`\`

### 표

| 언어 | 분야 |
|------|------|
| JavaScript | 웹 |
| Python | 데이터/AI |
| Go | 백엔드 |

### 링크와 이미지

[Claude Code](https://claude.com/claude-code)

---

지금 바로 편집해 보세요!
`;

marked.setOptions({
    breaks: true,
    gfm: true,
});

function render() {
    preview.innerHTML = marked.parse(editor.value);
}

let saveTimer;
function scheduleSave() {
    status.textContent = "저장 중...";
    status.classList.add("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, editor.value);
        status.textContent = "자동 저장됨";
        status.classList.remove("saving");
    }, 400);
}

function load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    editor.value = saved !== null ? saved : DEFAULT_CONTENT;
    render();
}

editor.addEventListener("input", () => {
    render();
    scheduleSave();
});

/* Toolbar: wrap or insert markdown syntax */
function getSelection() {
    return {
        start: editor.selectionStart,
        end: editor.selectionEnd,
        text: editor.value.substring(editor.selectionStart, editor.selectionEnd),
    };
}

function applyEdit(newText, cursorOffset) {
    const { start, end } = getSelection();
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    editor.value = before + newText + after;
    const newPos = start + (cursorOffset ?? newText.length);
    editor.focus();
    editor.setSelectionRange(newPos, newPos);
    render();
    scheduleSave();
}

function wrap(prefix, suffix = prefix, placeholder = "") {
    const sel = getSelection();
    const inner = sel.text || placeholder;
    const newText = prefix + inner + suffix;
    const { start } = sel;
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(sel.end);
    editor.value = before + newText + after;
    const selStart = start + prefix.length;
    const selEnd = selStart + inner.length;
    editor.focus();
    editor.setSelectionRange(selStart, selEnd);
    render();
    scheduleSave();
}

function prependLine(prefix) {
    const { start } = getSelection();
    const value = editor.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    editor.value =
        value.substring(0, lineStart) + prefix + value.substring(lineStart);
    const newPos = start + prefix.length;
    editor.focus();
    editor.setSelectionRange(newPos, newPos);
    render();
    scheduleSave();
}

function insertBlock(block) {
    const sel = getSelection();
    const value = editor.value;
    const needsNewlineBefore =
        sel.start > 0 && value[sel.start - 1] !== "\n" ? "\n" : "";
    const text = needsNewlineBefore + block;
    applyEdit(text);
}

const ACTIONS = {
    bold: () => wrap("**", "**", "굵게"),
    italic: () => wrap("*", "*", "기울임"),
    strike: () => wrap("~~", "~~", "취소선"),
    h1: () => prependLine("# "),
    h2: () => prependLine("## "),
    h3: () => prependLine("### "),
    ul: () => prependLine("- "),
    ol: () => prependLine("1. "),
    quote: () => prependLine("> "),
    code: () => wrap("`", "`", "code"),
    codeblock: () => {
        const sel = getSelection();
        const inner = sel.text || "코드를 입력하세요";
        insertBlock("\n```\n" + inner + "\n```\n");
    },
    link: () => {
        const sel = getSelection();
        const label = sel.text || "링크 텍스트";
        wrap("[", "](https://)", label);
    },
    image: () => {
        const sel = getSelection();
        const alt = sel.text || "alt text";
        wrap("![", "](https://)", alt);
    },
    hr: () => insertBlock("\n\n---\n\n"),
};

document.querySelectorAll(".toolbar button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        ACTIONS[action]?.();
    });
});

/* Keyboard shortcuts */
editor.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
        e.preventDefault();
        ACTIONS.bold();
    } else if (key === "i") {
        e.preventDefault();
        ACTIONS.italic();
    } else if (key === "k") {
        e.preventDefault();
        ACTIONS.link();
    }
});

/* Tab key inserts spaces instead of moving focus */
editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
        e.preventDefault();
        const { start, end } = getSelection();
        editor.value =
            editor.value.substring(0, start) +
            "  " +
            editor.value.substring(end);
        editor.setSelectionRange(start + 2, start + 2);
        render();
        scheduleSave();
    }
});

/* Download as .md */
downloadBtn.addEventListener("click", () => {
    const blob = new Blob([editor.value], {
        type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
    a.href = url;
    a.download = `markdown-${ts}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

/* Clear */
clearBtn.addEventListener("click", () => {
    if (!confirm("정말 모두 지울까요? 이 작업은 되돌릴 수 없습니다.")) return;
    editor.value = "";
    localStorage.removeItem(STORAGE_KEY);
    render();
    editor.focus();
    status.textContent = "비워짐";
});

/* Init */
load();
