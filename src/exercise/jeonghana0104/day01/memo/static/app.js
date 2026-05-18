const API = "/api/memos";

const els = {
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
  toast: document.getElementById("toast"),
};

let state = {
  memos: [],
  currentId: null,
  filter: "",
  dirty: false,
};

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("memo-theme", theme);
}
function initTheme() {
  const saved = localStorage.getItem("memo-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}
els.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

// ---------- API ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ detail: "요청 실패" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function loadMemos() {
  state.memos = await api(API);
  renderList();
}

async function createMemo() {
  const memo = await api(API, {
    method: "POST",
    body: JSON.stringify({ title: "새 메모", content: "" }),
  });
  state.memos.unshift(memo);
  state.currentId = memo.id;
  renderList();
  openMemo(memo.id);
  els.title.focus();
  els.title.select();
  toast("새 메모를 만들었어요 🦀");
}

async function saveMemo() {
  if (state.currentId == null) return;
  const title = els.title.value.trim() || "제목 없음";
  const content = els.content.value;
  const updated = await api(`${API}/${state.currentId}`, {
    method: "PUT",
    body: JSON.stringify({ title, content }),
  });
  const idx = state.memos.findIndex((m) => m.id === updated.id);
  if (idx >= 0) state.memos[idx] = updated;
  state.memos.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  state.dirty = false;
  renderList();
  updateMeta(updated);
  els.savedStatus.textContent = "저장됨";
  setTimeout(() => { els.savedStatus.textContent = ""; }, 1500);
}

async function deleteMemo() {
  if (state.currentId == null) return;
  const target = state.memos.find((m) => m.id === state.currentId);
  if (!target) return;
  if (!confirm(`"${target.title}" 메모를 삭제할까요?`)) return;
  await api(`${API}/${state.currentId}`, { method: "DELETE" });
  state.memos = state.memos.filter((m) => m.id !== state.currentId);
  state.currentId = null;
  renderList();
  showEmpty();
  toast("메모를 삭제했어요");
}

// ---------- Render ----------
function renderList() {
  const filter = state.filter.toLowerCase();
  const filtered = filter
    ? state.memos.filter(
        (m) =>
          m.title.toLowerCase().includes(filter) ||
          m.content.toLowerCase().includes(filter),
      )
    : state.memos;

  els.list.innerHTML = "";
  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "memo-list-empty";
    li.textContent = state.memos.length === 0 ? "메모가 없습니다" : "검색 결과가 없어요";
    els.list.appendChild(li);
    return;
  }

  for (const memo of filtered) {
    const li = document.createElement("li");
    li.className = "memo-item" + (memo.id === state.currentId ? " active" : "");
    li.dataset.id = memo.id;
    li.innerHTML = `
      <p class="memo-title"></p>
      <p class="memo-preview"></p>
      <span class="memo-date"></span>
    `;
    li.querySelector(".memo-title").textContent = memo.title || "제목 없음";
    li.querySelector(".memo-preview").textContent =
      (memo.content || "").split("\n")[0] || "내용 없음";
    li.querySelector(".memo-date").textContent = formatDate(memo.updated_at);
    li.addEventListener("click", () => openMemo(memo.id));
    els.list.appendChild(li);
  }
}

function openMemo(id) {
  const memo = state.memos.find((m) => m.id === id);
  if (!memo) return;
  state.currentId = id;
  state.dirty = false;
  els.title.value = memo.title;
  els.content.value = memo.content;
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
  // SQLite returns "YYYY-MM-DD HH:MM:SS" in UTC
  if (!s) return "";
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ---------- Auto-save (debounced) ----------
let saveTimer;
function scheduleSave() {
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
els.search.addEventListener("input", (e) => {
  state.filter = e.target.value;
  renderList();
});

// Ctrl+S / Cmd+S
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (state.currentId != null) {
      saveMemo().catch((err) => toast(`저장 실패: ${err.message}`));
    }
  }
});

// ---------- Init ----------
initTheme();
loadMemos()
  .then(() => {
    if (state.memos.length > 0) openMemo(state.memos[0].id);
  })
  .catch((e) => toast(`불러오기 실패: ${e.message}`));
