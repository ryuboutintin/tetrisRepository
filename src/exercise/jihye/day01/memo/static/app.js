const authCard = document.getElementById("authCard");
const authForm = document.getElementById("authForm");
const authStatus = document.getElementById("authStatus");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const newMemoBtn = document.getElementById("newMemoBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const appShell = document.getElementById("appShell");
const memoList = document.getElementById("memoList");
const countText = document.getElementById("countText");
const editorTitle = document.getElementById("editorTitle");
const titleInput = document.getElementById("titleInput");
const categoryInput = document.getElementById("categoryInput");
const tagsInput = document.getElementById("tagsInput");
const kindInput = document.getElementById("kindInput");
const doneInput = document.getElementById("doneInput");
const todoField = document.getElementById("todoField");
const contentInput = document.getElementById("contentInput");
const previewBox = document.getElementById("previewBox");
const saveBtn = document.getElementById("saveBtn");
const deleteBtn = document.getElementById("deleteBtn");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");

const THEME_KEY = "memo-theme";
const TOKEN_KEY = "memo-token";
const USER_KEY = "memo-user";

let memos = [];
let currentId = null;
let accessToken = localStorage.getItem(TOKEN_KEY) || "";
let currentUser = null;

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
  applyTheme(getStoredTheme() || getPreferredTheme());
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

function setAuthView(isAuthenticated) {
  authCard.classList.toggle("hidden", isAuthenticated);
  appShell.classList.toggle("hidden", !isAuthenticated);
  logoutBtn.hidden = !isAuthenticated;
  newMemoBtn.hidden = !isAuthenticated;
}

function saveAuth(token, user) {
  accessToken = token;
  currentUser = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setAuthView(true);
}

function clearAuth() {
  accessToken = "";
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  memos = [];
  currentId = null;
  setForm(null);
  renderList();
  setAuthView(false);
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...options, headers });
  if (response.ok) {
    return response;
  }

  let detail = "Request failed";
  try {
    const data = await response.json();
    detail = data.detail || detail;
  } catch {
    // Ignore JSON parsing errors on non-JSON errors.
  }

  const error = new Error(detail);
  error.status = response.status;
  throw error;
}

async function apiJson(path, options = {}) {
  const response = await apiRequest(path, options);
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tagsToText(tags) {
  return (tags || []).join(", ");
}

function renderTagChips(tags) {
  if (!tags.length) {
    return '<span class="empty">태그 없음</span>';
  }
  return tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("");
}

function renderPreview() {
  const title = titleInput.value.trim();
  const category = categoryInput.value.trim();
  const tags = parseTags(tagsInput.value);
  const kind = kindInput.value;
  const isDone = doneInput.checked;
  const content = contentInput.value.trim();

  const meta = [
    `<span class="chip">${kind === "todo" ? "Todo" : "Memo"}</span>`,
    category ? `<span class="chip">${escapeHtml(category)}</span>` : "",
    isDone && kind === "todo" ? '<span class="chip">완료</span>' : "",
    ...tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`),
  ]
    .filter(Boolean)
    .join("");

  const safeTitle = title ? `<strong>${escapeHtml(title)}</strong>` : '<span class="empty">제목 없음</span>';
  const safeContent = content ? escapeHtml(content).replaceAll("\n", "<br />") : '<span class="empty">내용 없음</span>';
  previewBox.innerHTML = `
    <div class="preview-meta">${meta || '<span class="empty">메타 정보 없음</span>'}</div>
    ${safeTitle}<br /><br />
    ${safeContent}
  `;
}

function syncTodoField() {
  const isTodo = kindInput.value === "todo";
  todoField.classList.toggle("hidden", !isTodo);
  if (!isTodo) {
    doneInput.checked = false;
  }
  renderPreview();
}

function setForm(memo) {
  currentId = memo ? memo.id : null;
  titleInput.value = memo ? memo.title : "";
  categoryInput.value = memo ? memo.category : "";
  tagsInput.value = memo ? tagsToText(memo.tags) : "";
  kindInput.value = memo ? memo.kind : "memo";
  doneInput.checked = Boolean(memo && memo.is_done);
  contentInput.value = memo ? memo.content : "";
  editorTitle.textContent = memo ? `메모 #${memo.id}` : "새 메모";
  deleteBtn.disabled = !memo;
  syncTodoField();
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
      <div class="memo-meta">
        <span class="chip">${memo.kind === "todo" ? "Todo" : "Memo"}</span>
        ${memo.category ? `<span class="chip">${escapeHtml(memo.category)}</span>` : ""}
        ${memo.is_done && memo.kind === "todo" ? '<span class="chip">완료</span>' : ""}
      </div>
      <p class="memo-item-content">${escapeHtml(memo.content.slice(0, 80))}</p>
      <div class="memo-meta">${renderTagChips(memo.tags)}</div>
    `;
    button.addEventListener("click", () => setForm(memo));
    memoList.appendChild(button);
  }
}

async function loadMemos() {
  const data = await apiJson("/api/memos");
  memos = data;
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
    category: categoryInput.value.trim(),
    tags: parseTags(tagsInput.value),
    kind: kindInput.value,
    is_done: kindInput.value === "todo" ? doneInput.checked : false,
  };

  if (!payload.title || !payload.content) {
    alert("제목과 내용을 모두 입력하세요.");
    return;
  }

  const method = currentId ? "PUT" : "POST";
  const url = currentId ? `/api/memos/${currentId}` : "/api/memos";

  const saved = await apiJson(url, {
    method,
    body: JSON.stringify(payload),
  });

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

  await apiJson(`/api/memos/${currentId}`, { method: "DELETE" });
  currentId = null;
  setForm(null);
  await loadMemos();
}

async function submitAuth(mode) {
  const payload = {
    username: usernameInput.value.trim(),
    password: passwordInput.value,
  };

  if (!payload.username || !payload.password) {
    authStatus.textContent = "아이디와 비밀번호를 입력하세요.";
    return;
  }

  authStatus.textContent = mode === "login" ? "로그인 중..." : "회원가입 중...";

  try {
    const data = await apiJson(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveAuth(data.token, data.user);
    authStatus.textContent = `${data.user.username} 님으로 로그인했습니다.`;
    await loadMemos();
    setForm(null);
  } catch (error) {
    authStatus.textContent = error.message;
  }
}

async function bootstrapAuth() {
  const storedUser = localStorage.getItem(USER_KEY);
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
    } catch {
      currentUser = null;
    }
  }

  if (!accessToken) {
    setAuthView(false);
    return;
  }

  try {
    currentUser = await apiJson("/api/auth/me");
    setAuthView(true);
    await loadMemos();
  } catch (error) {
    if (error.status === 401) {
      clearAuth();
      authStatus.textContent = "세션이 만료되었습니다. 다시 로그인하세요.";
    } else {
      clearAuth();
      authStatus.textContent = "인증 확인에 실패했습니다.";
    }
  }
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitAuth("login");
});

registerBtn.addEventListener("click", () => submitAuth("register"));
logoutBtn.addEventListener("click", () => {
  clearAuth();
  authStatus.textContent = "로그아웃되었습니다.";
});
newMemoBtn.addEventListener("click", () => setForm(null));
saveBtn.addEventListener("click", () => {
  saveMemo().catch((error) => {
    if (error.status === 401) {
      clearAuth();
      authStatus.textContent = "다시 로그인하세요.";
      return;
    }
    alert(error.message);
  });
});
deleteBtn.addEventListener("click", () => {
  deleteMemo().catch((error) => {
    if (error.status === 401) {
      clearAuth();
      authStatus.textContent = "다시 로그인하세요.";
      return;
    }
    alert(error.message);
  });
});
themeToggleBtn.addEventListener("click", toggleTheme);
titleInput.addEventListener("input", renderPreview);
categoryInput.addEventListener("input", renderPreview);
tagsInput.addEventListener("input", renderPreview);
kindInput.addEventListener("change", syncTodoField);
doneInput.addEventListener("input", renderPreview);
contentInput.addEventListener("input", renderPreview);

initTheme();
setAuthView(false);
setForm(null);
bootstrapAuth();
