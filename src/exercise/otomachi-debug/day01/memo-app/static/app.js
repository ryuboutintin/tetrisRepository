/* ── State ── */
let token = localStorage.getItem("memo-token") || "";
let memos = [];
let tags  = [];
let currentId      = null;
let isNew          = false;
let currentTags    = [];   // tags assigned to memo being edited
let activeTagFilter = null; // tag id to filter, null = 전체

/* ── Elements ── */
const authScreen    = document.getElementById("auth-screen");
const appEl         = document.getElementById("app");
const authForm      = document.getElementById("auth-form");
const authUsername  = document.getElementById("auth-username");
const authPassword  = document.getElementById("auth-password");
const authError     = document.getElementById("auth-error");
const authSubmit    = document.getElementById("auth-submit");
const usernameBadge = document.getElementById("username-badge");

const memoList      = document.getElementById("memo-list");
const emptyState    = document.getElementById("empty-state");
const editorEl      = document.getElementById("editor");
const titleInput    = document.getElementById("memo-title");
const contentInput  = document.getElementById("memo-content");
const memoMeta      = document.getElementById("memo-meta");
const searchInput   = document.getElementById("search");
const assignedTagsEl= document.getElementById("assigned-tags");
const tagDropdownEl = document.getElementById("tag-dropdown");
const tagFilterList = document.getElementById("tag-filter-list");
const toast         = document.getElementById("toast");

/* ── API fetch helper ── */
async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers, ...options });
  if (res.status === 401) { logout(); return null; }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ── Toast ── */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

/* ── Auth: Tab UI ── */
let authMode = "login";
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.tab;
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    authSubmit.textContent = authMode === "login" ? "로그인" : "회원가입";
    authError.textContent = "";
  });
});

/* ── Auth: Submit ── */
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const username = authUsername.value.trim();
  const password = authPassword.value;

  try {
    if (authMode === "register") {
      const data = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }).then(r => { if (!r.ok) return r.json().then(d => { throw new Error(d.detail); }); return r.json(); });
      token = data.access_token;
    } else {
      const form = new URLSearchParams({ username, password });
      const data = await fetch("/auth/login", { method: "POST", body: form })
        .then(r => { if (!r.ok) return r.json().then(d => { throw new Error(d.detail); }); return r.json(); });
      token = data.access_token;
    }
    localStorage.setItem("memo-token", token);
    await enterApp(username);
  } catch (err) {
    authError.textContent = err.message;
  }
});

/* ── Enter App ── */
async function enterApp(username) {
  authScreen.style.display = "none";
  appEl.style.display      = "flex";
  usernameBadge.textContent = username;
  await Promise.all([loadTags(), loadMemos()]);
}

function logout() {
  token = "";
  localStorage.removeItem("memo-token");
  authScreen.style.display = "flex";
  appEl.style.display      = "none";
  authUsername.value = "";
  authPassword.value = "";
  authError.textContent = "";
  memos = []; tags = [];
  showEmpty();
}

document.getElementById("btn-logout").addEventListener("click", logout);

/* ── Tags: Load & Render sidebar ── */
async function loadTags() {
  tags = await api("/tags") || [];
  renderTagFilter();
}

function renderTagFilter() {
  tagFilterList.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.className = "tag-filter-chip" + (activeTagFilter === null ? " active" : "");
  allChip.textContent = "전체";
  allChip.addEventListener("click", () => { activeTagFilter = null; renderTagFilter(); renderList(); });
  tagFilterList.appendChild(allChip);

  tags.forEach(tag => {
    const chip = document.createElement("button");
    chip.className = "tag-filter-chip" + (activeTagFilter === tag.id ? " active" : "");
    chip.innerHTML = `${escHtml(tag.name)} <button class="tag-delete-btn" data-id="${tag.id}" title="태그 삭제">×</button>`;
    chip.addEventListener("click", (e) => {
      if (e.target.classList.contains("tag-delete-btn")) return;
      activeTagFilter = tag.id;
      renderTagFilter();
      renderList();
    });
    chip.querySelector(".tag-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`'${tag.name}' 태그를 삭제하시겠습니까?`)) return;
      await api(`/tags/${tag.id}`, { method: "DELETE" });
      if (activeTagFilter === tag.id) activeTagFilter = null;
      await loadTags();
      await loadMemos();
      if (currentId !== null || isNew) renderTagBar();
      showToast("태그가 삭제되었습니다.");
    });
    tagFilterList.appendChild(chip);
  });
}

/* ── Tags: Add new ── */
const btnShowAddTag = document.getElementById("btn-show-add-tag");
const addTagForm    = document.getElementById("add-tag-form");
const newTagInput   = document.getElementById("new-tag-input");

btnShowAddTag.addEventListener("click", () => {
  const visible = addTagForm.style.display !== "none";
  addTagForm.style.display = visible ? "none" : "flex";
  if (!visible) newTagInput.focus();
});

document.getElementById("btn-tag-submit").addEventListener("click", addTag);
newTagInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } });

async function addTag() {
  const name = newTagInput.value.trim();
  if (!name) return;
  try {
    const tag = await api("/tags", { method: "POST", body: JSON.stringify({ name }) });
    if (!tag) return;
    tags.push(tag);
    newTagInput.value = "";
    addTagForm.style.display = "none";
    renderTagFilter();
    if (currentId !== null || isNew) renderTagBar();
    showToast(`'${tag.name}' 태그가 추가되었습니다.`);
  } catch (err) {
    showToast(err.message);
  }
}

/* ── Tags: Tag bar in editor ── */
let tagDropdownOpen = false;

function renderTagBar() {
  const assignedIds = currentTags.map(t => t.id);
  const available   = tags.filter(t => !assignedIds.includes(t.id));

  assignedTagsEl.innerHTML = currentTags.map(t =>
    `<span class="assigned-tag-chip">${escHtml(t.name)}<button data-id="${t.id}" title="제거">×</button></span>`
  ).join("");

  assignedTagsEl.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      currentTags = currentTags.filter(t => t.id !== Number(btn.dataset.id));
      renderTagBar();
    });
  });

  tagDropdownEl.innerHTML = available.length === 0
    ? `<div class="tag-dropdown-empty">추가할 태그 없음</div>`
    : available.map(t => `<button class="tag-dropdown-item" data-id="${t.id}">${escHtml(t.name)}</button>`).join("");

  tagDropdownEl.querySelectorAll(".tag-dropdown-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = tags.find(t => t.id === Number(btn.dataset.id));
      if (tag) { currentTags.push(tag); renderTagBar(); }
    });
  });
}

document.getElementById("btn-tag-dropdown").addEventListener("click", (e) => {
  e.stopPropagation();
  tagDropdownOpen = !tagDropdownOpen;
  tagDropdownEl.style.display = tagDropdownOpen ? "block" : "none";
});
document.addEventListener("click", () => {
  tagDropdownOpen = false;
  tagDropdownEl.style.display = "none";
});

/* ── Memos: Load ── */
async function loadMemos() {
  memos = await api("/memos") || [];
  renderList();
}

/* ── Memos: Render list ── */
function renderList() {
  const q = searchInput.value.toLowerCase();

  let filtered = memos.filter(m => {
    const matchText = m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q);
    const matchTag  = activeTagFilter === null || m.tags.some(t => t.id === activeTagFilter);
    return matchText && matchTag;
  });

  memoList.innerHTML = "";
  if (filtered.length === 0) {
    memoList.innerHTML = `<li class="memo-list-empty">${searchInput.value || activeTagFilter !== null ? "검색 결과 없음" : "메모가 없습니다"}</li>`;
    return;
  }

  filtered.forEach(m => {
    const li = document.createElement("li");
    li.className = "memo-item" + (m.id === currentId ? " active" : "");
    li.dataset.id = m.id;
    const tagChips = m.tags.map(t => `<span class="memo-item-tag">${escHtml(t.name)}</span>`).join("");
    li.innerHTML = `
      <div class="memo-item-title">${escHtml(m.title || "제목 없음")}</div>
      <div class="memo-item-preview">${escHtml(m.content.replace(/\n/g," ")) || "내용 없음"}</div>
      <div class="memo-item-footer">
        <span class="memo-item-date">${fmtDate(m.updated_at)}</span>
        ${tagChips}
      </div>`;
    li.addEventListener("click", () => openMemo(m.id));
    memoList.appendChild(li);
  });
}

/* ── Memos: Open / Editor ── */
function showEditor() { emptyState.style.display = "none"; editorEl.style.display = "flex"; }
function showEmpty()  {
  emptyState.style.display = "";
  editorEl.style.display   = "none";
  currentId = null; isNew = false; currentTags = [];
  tagDropdownEl.style.display = "none";
}

function openMemo(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;
  currentId   = id;
  isNew       = false;
  currentTags = [...memo.tags];
  titleInput.value   = memo.title;
  contentInput.value = memo.content;
  memoMeta.textContent = `생성: ${fmtDate(memo.created_at)} · 수정: ${fmtDate(memo.updated_at)}`;
  showEditor();
  renderTagBar();
  renderList();
  titleInput.focus();
}

document.getElementById("btn-new").addEventListener("click", () => {
  currentId   = null;
  isNew       = true;
  currentTags = [];
  titleInput.value   = "";
  contentInput.value = "";
  memoMeta.textContent = "";
  showEditor();
  renderTagBar();
  renderList();
  titleInput.focus();
});

document.getElementById("btn-cancel").addEventListener("click", () => { showEmpty(); renderList(); });

/* ── Memos: Save ── */
document.getElementById("btn-save").addEventListener("click", saveMemo);
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (editorEl.style.display !== "none") saveMemo();
  }
});

async function saveMemo() {
  const title   = titleInput.value.trim();
  const content = contentInput.value;
  const tag_ids = currentTags.map(t => t.id);
  if (!title) { showToast("제목을 입력하세요."); titleInput.focus(); return; }

  try {
    if (isNew) {
      const created = await api("/memos", { method: "POST", body: JSON.stringify({ title, content, tag_ids }) });
      if (!created) return;
      memos.unshift(created);
      currentId = created.id;
      isNew = false;
      memoMeta.textContent = `생성: ${fmtDate(created.created_at)} · 수정: ${fmtDate(created.updated_at)}`;
    } else {
      const updated = await api(`/memos/${currentId}`, { method: "PUT", body: JSON.stringify({ title, content, tag_ids }) });
      if (!updated) return;
      const idx = memos.findIndex(m => m.id === currentId);
      if (idx !== -1) memos[idx] = updated;
      memos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      memoMeta.textContent = `생성: ${fmtDate(updated.created_at)} · 수정: ${fmtDate(updated.updated_at)}`;
    }
    renderList();
    showToast("저장되었습니다.");
  } catch (err) {
    showToast("저장 실패: " + err.message);
  }
}

/* ── Memos: Delete ── */
document.getElementById("btn-delete").addEventListener("click", async () => {
  if (isNew) { showEmpty(); renderList(); return; }
  if (!confirm("이 메모를 삭제하시겠습니까?")) return;
  try {
    await api(`/memos/${currentId}`, { method: "DELETE" });
    memos = memos.filter(m => m.id !== currentId);
    showEmpty();
    renderList();
    showToast("삭제되었습니다.");
  } catch (err) {
    showToast("삭제 실패: " + err.message);
  }
});

/* ── Search ── */
searchInput.addEventListener("input", () => renderList());

/* ── Init: check token ── */
(async () => {
  if (!token) return;
  try {
    const me = await fetch("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!me.ok) { logout(); return; }
    const { username } = await me.json();
    await enterApp(username);
  } catch {
    logout();
  }
})();
