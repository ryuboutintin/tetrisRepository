const memoList = document.getElementById("memoList");
const countText = document.getElementById("countText");
const editorTitle = document.getElementById("editorTitle");
const titleInput = document.getElementById("titleInput");
const contentInput = document.getElementById("contentInput");
const previewBox = document.getElementById("previewBox");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");
const newMemoBtn = document.getElementById("newMemoBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");

const THEME_KEY = "memo-theme";

let memos = [];
let currentId = null;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY);
}

function getPreferredTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolvedTheme;
  themeToggleBtn.textContent = resolvedTheme === "dark" ? "라이트모드" : "다크모드";
  themeToggleBtn.setAttribute("aria-pressed", String(resolvedTheme === "dark"));
}

function initTheme() {
  const storedTheme = getStoredTheme();
  applyTheme(storedTheme || getPreferredTheme());
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

function renderPreview() {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const safeTitle = title ? `<strong>${escapeHtml(title)}</strong>` : '<span class="empty">제목 없음</span>';
  const safeContent = content ? escapeHtml(content).replaceAll("\n", "<br />") : '<span class="empty">내용 없음</span>';
  previewBox.innerHTML = `${safeTitle}<br /><br />${safeContent}`;
}

function setForm(memo) {
  currentId = memo ? memo.id : null;
  titleInput.value = memo ? memo.title : "";
  contentInput.value = memo ? memo.content : "";
  editorTitle.textContent = memo ? `메모 #${memo.id}` : "새 메모";
  deleteBtn.disabled = !memo;
  renderPreview();
  renderList();
}

function renderList() {
  countText.textContent = `${memos.length}개`;
  memoList.innerHTML = "";

  if (!memos.length) {
    memoList.innerHTML = '<p class="empty">저장된 메모가 없습니다.</p>';
    return;
  }

  for (const memo of memos) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `memo-item${memo.id === currentId ? " active" : ""}`;
    button.innerHTML = `
      <div class="memo-item-title">
        <span>${escapeHtml(memo.title)}</span>
        <small>#${memo.id}</small>
      </div>
      <p class="memo-item-content">${escapeHtml(memo.content.slice(0, 80))}</p>
    `;
    button.addEventListener("click", () => setForm(memo));
    memoList.appendChild(button);
  }
}

async function loadMemos() {
  const response = await fetch("/api/memos");
  memos = await response.json();
  if (currentId === null && memos.length) {
    setForm(memos[0]);
  } else {
    renderList();
  }
}

async function saveMemo() {
  const payload = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
  };

  if (!payload.title || !payload.content) {
    alert("제목과 내용을 모두 입력하세요.");
    return;
  }

  const method = currentId ? "PUT" : "POST";
  const url = currentId ? `/api/memos/${currentId}` : "/api/memos";

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    alert("저장에 실패했습니다.");
    return;
  }

  const saved = await response.json();
  await loadMemos();
  setForm(saved);
}

async function deleteMemo() {
  if (!currentId) {
    return;
  }

  if (!confirm("이 메모를 삭제할까요?")) {
    return;
  }

  const response = await fetch(`/api/memos/${currentId}`, { method: "DELETE" });
  if (!response.ok) {
    alert("삭제에 실패했습니다.");
    return;
  }

  currentId = null;
  setForm(null);
  await loadMemos();
}

newMemoBtn.addEventListener("click", () => setForm(null));
saveBtn.addEventListener("click", saveMemo);
deleteBtn.addEventListener("click", deleteMemo);
themeToggleBtn.addEventListener("click", toggleTheme);
titleInput.addEventListener("input", renderPreview);
contentInput.addEventListener("input", renderPreview);

initTheme();
loadMemos().catch(() => {
  memoList.innerHTML = '<p class="empty">API 연결에 실패했습니다.</p>';
});
setForm(null);
