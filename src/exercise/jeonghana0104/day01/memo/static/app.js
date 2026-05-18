// ============== Claude Memo client ==============

const API = "/api";
const TOKEN_KEY = "memo-token";
const USER_KEY = "memo-user";
const THEME_KEY = "memo-theme";

const els = {
  // auth
  authScreen: document.getElementById("authScreen"),
  authForm: document.getElementById("authForm"),
  authUsername: document.getElementById("authUsername"),
  authPassword: document.getElementById("authPassword"),
  authSubmit: document.querySelector(".auth-submit"),
  authToggle: document.getElementById("authToggle"),
  authSubtitle: document.getElementById("authSubtitle"),
  authThemeToggle: document.getElementById("authThemeToggle"),
  // app
  app: document.getElementById("app"),
  usernameLabel: document.getElementById("usernameLabel"),
  logoutBtn: document.getElementById("logoutBtn"),
  list: document.getElementById("memoList"),
  newBtn: document.getElementById("newMemoBtn"),
  search: document.getElementById("searchInput"),
  empty: document.getElementById("emptyState"),
  pane: document.getElementById("editorPane"),
  title: document.getElementById("titleInput"),
  content: document.getElementById("contentInput"),
  saveBtn: document.getElementById("saveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  savedStatus: document.getElementById("savedStatus"),
  meta: document.getElementById("metaInfo"),
  themeToggle: document.getElementById("themeToggle"),
  // category / tag
  categoryList: document.getElementById("categoryList"),
  newCategoryBtn: document.getElementById("newCategoryBtn"),
  categorySelect: document.getElementById("categorySelect"),
  tagCloud: document.getElementById("tagCloud"),
  tagEditor: document.getElementById("tagEditor"),
  tagInput: document.getElementById("tagInput"),
  // modal
  categoryModal: document.getElementById("categoryModal"),
  categoryModalTitle: document.getElementById("categoryModalTitle"),
  categoryForm: document.getElementById("categoryForm"),
  categoryName: document.getElementById("categoryName"),
  categoryColor: document.getElementById("categoryColor"),
  categoryCancelBtn: document.getElementById("categoryCancelBtn"),
  categoryDeleteBtn: document.getElementById("categoryDeleteBtn"),
  // misc
  toast: document.getElementById("toast"),
};

let state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
  authMode: "login", // or "register"
  memos: [],
  categories: [],
  tags: [],
  currentId: null,
  filter: { q: "", categoryId: null, tag: null },
  dirty: false,
  editingCategoryId: null,
};

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
}
els.themeToggle.addEventListener("click", toggleTheme);
els.authThemeToggle.addEventListener("click", toggleTheme);

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2000);
}

// ---------- API helper ----------
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(API + path, { ...options, headers });
  if (res.status === 401) {
    logout();
    throw new Error("로그인이 필요합니다");
  }
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ detail: "요청 실패" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ---------- Auth ----------
function showAuth() {
  els.authScreen.classList.remove("hidden");
  els.app.classList.add("hidden");
  els.authUsername.focus();
}

function showApp() {
  els.authScreen.classList.add("hidden");
  els.app.classList.remove("hidden");
  els.usernameLabel.textContent = `🦀 ${state.user.username}`;
}

function setAuthMode(mode) {
  state.authMode = mode;
  if (mode === "register") {
    els.authSubmit.textContent = "가입하기";
    els.authSubtitle.textContent = "환영해요! 새 계정을 만드세요 🦀";
    els.authToggle.innerHTML = "이미 계정이 있다면 <strong>로그인</strong>";
    els.authPassword.autocomplete = "new-password";
  } else {
    els.authSubmit.textContent = "로그인";
    els.authSubtitle.textContent = "집게로 꾹꾹 적어둔 메모들 🦀";
    els.authToggle.innerHTML = "회원가입은 처음이신가요? <strong>가입하기</strong>";
    els.authPassword.autocomplete = "current-password";
  }
}

els.authToggle.addEventListener("click", () =>
  setAuthMode(state.authMode === "login" ? "register" : "login"),
);

els.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;
  if (!username || !password) return;
  const path = state.authMode === "register" ? "/auth/register" : "/auth/login";
  try {
    const data = await api(path, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem(TOKEN_KEY, state.token);
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    els.authPassword.value = "";
    showApp();
    await bootstrap();
    toast(state.authMode === "register" ? `환영해요, ${state.user.username}님! 🦀` : "어서 오세요 🦀");
  } catch (err) {
    toast(err.message);
  }
});

function logout() {
  state.token = null;
  state.user = null;
  state.memos = [];
  state.categories = [];
  state.tags = [];
  state.currentId = null;
  state.filter = { q: "", categoryId: null, tag: null };
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  showAuth();
}

els.logoutBtn.addEventListener("click", () => {
  if (confirm("로그아웃 하시겠어요?")) {
    logout();
    toast("로그아웃 되었어요");
  }
});

// ---------- Data loading ----------
async function bootstrap() {
  await Promise.all([loadCategories(), loadTags()]);
  await loadMemos();
  renderCategories();
  renderTags();
  if (state.memos.length > 0) openMemo(state.memos[0].id);
  else showEmpty();
}

async function loadCategories() {
  state.categories = await api("/categories");
}
async function loadTags() {
  state.tags = await api("/tags");
}
async function loadMemos() {
  const params = new URLSearchParams();
  if (state.filter.categoryId != null) params.set("category_id", state.filter.categoryId);
  if (state.filter.tag) params.set("tag", state.filter.tag);
  if (state.filter.q) params.set("q", state.filter.q);
  const qs = params.toString();
  state.memos = await api(`/memos${qs ? "?" + qs : ""}`);
  renderList();
}

// ---------- Render: categories ----------
function renderCategories() {
  els.categoryList.innerHTML = "";

  const allLi = document.createElement("li");
  allLi.className = "category-item" + (state.filter.categoryId == null ? " active" : "");
  allLi.innerHTML = `<span class="category-dot" style="background:var(--text-muted)"></span><span class="category-name">전체</span>`;
  allLi.addEventListener("click", () => setCategoryFilter(null));
  els.categoryList.appendChild(allLi);

  if (state.categories.length === 0) {
    const empty = document.createElement("li");
    empty.className = "section-empty";
    empty.textContent = "+ 버튼으로 추가";
    els.categoryList.appendChild(empty);
  } else {
    for (const cat of state.categories) {
      const li = document.createElement("li");
      li.className =
        "category-item" + (state.filter.categoryId === cat.id ? " active" : "");
      li.innerHTML = `
        <span class="category-dot" style="background:${escapeAttr(cat.color)}"></span>
        <span class="category-name"></span>
        <button class="category-edit" title="편집">✎</button>
      `;
      li.querySelector(".category-name").textContent = cat.name;
      li.addEventListener("click", (e) => {
        if (e.target.classList.contains("category-edit")) return;
        setCategoryFilter(cat.id);
      });
      li.querySelector(".category-edit").addEventListener("click", (e) => {
        e.stopPropagation();
        openCategoryModal(cat);
      });
      els.categoryList.appendChild(li);
    }
  }

  // editor select
  const prev = els.categorySelect.value;
  els.categorySelect.innerHTML = '<option value="">없음</option>';
  for (const cat of state.categories) {
    const opt = document.createElement("option");
    opt.value = String(cat.id);
    opt.textContent = cat.name;
    els.categorySelect.appendChild(opt);
  }
  els.categorySelect.value = prev;
}

function setCategoryFilter(catId) {
  state.filter.categoryId = catId;
  loadMemos().then(renderCategories).catch((e) => toast(e.message));
}

// ---------- Render: tags ----------
function renderTags() {
  els.tagCloud.innerHTML = "";
  if (state.tags.length === 0) {
    const empty = document.createElement("span");
    empty.className = "section-empty";
    empty.textContent = "메모에 태그를 달아보세요";
    els.tagCloud.appendChild(empty);
    return;
  }
  for (const tag of state.tags) {
    const chip = document.createElement("span");
    chip.className = "tag-chip" + (state.filter.tag === tag.name ? " active" : "");
    chip.textContent = tag.name;
    chip.addEventListener("click", () => {
      state.filter.tag = state.filter.tag === tag.name ? null : tag.name;
      loadMemos().then(renderTags).catch((e) => toast(e.message));
    });
    els.tagCloud.appendChild(chip);
  }
}

// ---------- Render: memos ----------
function renderList() {
  els.list.innerHTML = "";
  if (state.memos.length === 0) {
    const li = document.createElement("li");
    li.className = "memo-list-empty";
    li.textContent = hasAnyFilter() ? "조건에 맞는 메모가 없어요" : "메모가 없습니다";
    els.list.appendChild(li);
    return;
  }
  for (const memo of state.memos) {
    const li = document.createElement("li");
    li.className = "memo-item" + (memo.id === state.currentId ? " active" : "");
    const dot = memo.category_color
      ? `<span class="mini-cat-dot" style="background:${escapeAttr(memo.category_color)}"></span>`
      : "";
    const tagsHtml = (memo.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="mini-tag">${escapeHtml(t)}</span>`)
      .join("");
    li.innerHTML = `
      <div class="memo-row">${dot}<p class="memo-title"></p></div>
      <p class="memo-preview"></p>
      <span class="memo-date"></span>
      ${tagsHtml ? `<div class="memo-item-tags">${tagsHtml}</div>` : ""}
    `;
    li.querySelector(".memo-title").textContent = memo.title || "제목 없음";
    li.querySelector(".memo-preview").textContent =
      (memo.content || "").split("\n")[0] || "내용 없음";
    li.querySelector(".memo-date").textContent = formatDate(memo.updated_at);
    li.addEventListener("click", () => openMemo(memo.id));
    els.list.appendChild(li);
  }
}

function hasAnyFilter() {
  return state.filter.categoryId != null || state.filter.tag != null || state.filter.q;
}

// ---------- Memo CRUD ----------
async function createMemo() {
  const payload = {
    title: "새 메모",
    content: "",
    category_id: state.filter.categoryId,
    tags: state.filter.tag ? [state.filter.tag] : [],
  };
  const memo = await api("/memos", { method: "POST", body: JSON.stringify(payload) });
  state.memos.unshift(memo);
  state.currentId = memo.id;
  renderList();
  openMemo(memo.id);
  els.title.focus();
  els.title.select();
  await loadTags().then(renderTags);
  toast("새 메모를 만들었어요 🦀");
}

async function saveMemo() {
  if (state.currentId == null) return;
  const title = els.title.value.trim() || "제목 없음";
  const content = els.content.value;
  const category_id = els.categorySelect.value ? Number(els.categorySelect.value) : null;
  const tags = getTagsFromEditor();
  const updated = await api(`/memos/${state.currentId}`, {
    method: "PUT",
    body: JSON.stringify({ title, content, category_id, tags }),
  });
  const idx = state.memos.findIndex((m) => m.id === updated.id);
  if (idx >= 0) state.memos[idx] = updated;
  state.memos.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  state.dirty = false;
  renderList();
  updateMeta(updated);
  await loadTags().then(renderTags);
  els.savedStatus.textContent = "저장됨";
  setTimeout(() => { els.savedStatus.textContent = ""; }, 1500);
}

async function deleteMemo() {
  if (state.currentId == null) return;
  const target = state.memos.find((m) => m.id === state.currentId);
  if (!target) return;
  if (!confirm(`"${target.title}" 메모를 삭제할까요?`)) return;
  await api(`/memos/${state.currentId}`, { method: "DELETE" });
  state.memos = state.memos.filter((m) => m.id !== state.currentId);
  state.currentId = null;
  renderList();
  showEmpty();
  await loadTags().then(renderTags);
  toast("메모를 삭제했어요");
}

function openMemo(id) {
  const memo = state.memos.find((m) => m.id === id);
  if (!memo) return;
  state.currentId = id;
  state.dirty = false;
  els.title.value = memo.title;
  els.content.value = memo.content;
  els.categorySelect.value = memo.category_id ? String(memo.category_id) : "";
  setTagsInEditor(memo.tags || []);
  els.empty.classList.add("hidden");
  els.pane.classList.remove("hidden");
  updateMeta(memo);
  renderList();
}

function showEmpty() {
  els.pane.classList.add("hidden");
  els.empty.classList.remove("hidden");
}

function updateMeta(memo) {
  els.meta.textContent = `생성 ${formatDate(memo.created_at)} · 마지막 수정 ${formatDate(memo.updated_at)}`;
}

function formatDate(s) {
  if (!s) return "";
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ---------- Tag editor ----------
function getTagsFromEditor() {
  return Array.from(els.tagEditor.querySelectorAll(".tag-pill"))
    .map((el) => el.dataset.name)
    .filter(Boolean);
}

function setTagsInEditor(names) {
  els.tagEditor.querySelectorAll(".tag-pill").forEach((el) => el.remove());
  for (const name of names) addTagPill(name);
}

function addTagPill(name) {
  name = name.trim();
  if (!name) return false;
  if (getTagsFromEditor().includes(name)) return false;
  const span = document.createElement("span");
  span.className = "tag-pill";
  span.dataset.name = name;
  span.innerHTML = `<span></span><button type="button" aria-label="제거">×</button>`;
  span.querySelector("span").textContent = name;
  span.querySelector("button").addEventListener("click", () => {
    span.remove();
    scheduleSave();
  });
  els.tagEditor.insertBefore(span, els.tagInput);
  return true;
}

els.tagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    if (addTagPill(els.tagInput.value)) {
      els.tagInput.value = "";
      scheduleSave();
    }
  } else if (e.key === "Backspace" && !els.tagInput.value) {
    const last = els.tagEditor.querySelectorAll(".tag-pill");
    if (last.length > 0) {
      last[last.length - 1].remove();
      scheduleSave();
    }
  }
});

els.tagInput.addEventListener("blur", () => {
  if (els.tagInput.value.trim() && addTagPill(els.tagInput.value)) {
    els.tagInput.value = "";
    scheduleSave();
  }
});

// ---------- Category modal ----------
function openCategoryModal(category = null) {
  state.editingCategoryId = category ? category.id : null;
  els.categoryModalTitle.textContent = category ? "카테고리 편집" : "새 카테고리";
  els.categoryName.value = category ? category.name : "";
  els.categoryColor.value = category ? category.color : "#d97757";
  els.categoryDeleteBtn.classList.toggle("hidden", !category);
  els.categoryModal.classList.remove("hidden");
  setTimeout(() => els.categoryName.focus(), 0);
}

function closeCategoryModal() {
  els.categoryModal.classList.add("hidden");
  state.editingCategoryId = null;
}

els.newCategoryBtn.addEventListener("click", () => openCategoryModal());
els.categoryCancelBtn.addEventListener("click", closeCategoryModal);
els.categoryModal.addEventListener("click", (e) => {
  if (e.target === els.categoryModal) closeCategoryModal();
});

els.categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = els.categoryName.value.trim();
  const color = els.categoryColor.value;
  if (!name) return;
  try {
    if (state.editingCategoryId) {
      await api(`/categories/${state.editingCategoryId}`, {
        method: "PUT",
        body: JSON.stringify({ name, color }),
      });
      toast("카테고리를 수정했어요");
    } else {
      await api("/categories", {
        method: "POST",
        body: JSON.stringify({ name, color }),
      });
      toast("카테고리를 만들었어요");
    }
    closeCategoryModal();
    await loadCategories();
    renderCategories();
    await loadMemos();
  } catch (err) {
    toast(err.message);
  }
});

els.categoryDeleteBtn.addEventListener("click", async () => {
  if (!state.editingCategoryId) return;
  if (!confirm("카테고리를 삭제할까요? 메모는 유지되지만 카테고리에서 분리됩니다.")) return;
  try {
    await api(`/categories/${state.editingCategoryId}`, { method: "DELETE" });
    closeCategoryModal();
    if (state.filter.categoryId === state.editingCategoryId) state.filter.categoryId = null;
    await loadCategories();
    renderCategories();
    await loadMemos();
    toast("카테고리를 삭제했어요");
  } catch (err) {
    toast(err.message);
  }
});

// ---------- Auto-save ----------
let saveTimer;
function scheduleSave() {
  if (state.currentId == null) return;
  state.dirty = true;
  els.savedStatus.textContent = "저장 중...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (state.dirty) saveMemo().catch((e) => toast(`저장 실패: ${e.message}`));
  }, 700);
}

// ---------- Events ----------
els.newBtn.addEventListener("click", () =>
  createMemo().catch((e) => toast(`생성 실패: ${e.message}`)),
);
els.saveBtn.addEventListener("click", () =>
  saveMemo().catch((e) => toast(`저장 실패: ${e.message}`)),
);
els.deleteBtn.addEventListener("click", () =>
  deleteMemo().catch((e) => toast(`삭제 실패: ${e.message}`)),
);
els.title.addEventListener("input", scheduleSave);
els.content.addEventListener("input", scheduleSave);
els.categorySelect.addEventListener("change", scheduleSave);

let searchTimer;
els.search.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  state.filter.q = e.target.value.trim();
  searchTimer = setTimeout(() => loadMemos().catch((err) => toast(err.message)), 250);
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (state.currentId != null) saveMemo().catch((err) => toast(`저장 실패: ${err.message}`));
  }
});

// ---------- Util ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
function escapeAttr(s) {
  return escapeHtml(s);
}

// ---------- Init ----------
initTheme();
if (state.token && state.user) {
  showApp();
  bootstrap().catch((e) => {
    toast(e.message);
    logout();
  });
} else {
  showAuth();
}
