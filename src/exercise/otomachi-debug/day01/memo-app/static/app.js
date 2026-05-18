const API = "/memos";

/* ── Elements ── */
const memoList    = document.getElementById("memo-list");
const emptyState  = document.getElementById("empty-state");
const editorEl    = document.getElementById("editor");
const titleInput  = document.getElementById("memo-title");
const contentInput= document.getElementById("memo-content");
const memoMeta    = document.getElementById("memo-meta");
const searchInput = document.getElementById("search");
const toast       = document.getElementById("toast");

let memos = [];
let currentId = null;
let isNew = false;

/* ── API helpers ── */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
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

/* ── Date format ── */
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ── Render memo list ── */
function renderList(filter = "") {
  const q = filter.toLowerCase();
  const filtered = memos.filter(m =>
    m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q)
  );

  memoList.innerHTML = "";

  if (filtered.length === 0) {
    memoList.innerHTML = `<li class="memo-list-empty">${filter ? "검색 결과 없음" : "메모가 없습니다"}</li>`;
    return;
  }

  filtered.forEach(m => {
    const li = document.createElement("li");
    li.className = "memo-item" + (m.id === currentId ? " active" : "");
    li.dataset.id = m.id;
    li.innerHTML = `
      <div class="memo-item-title">${escHtml(m.title || "제목 없음")}</div>
      <div class="memo-item-preview">${escHtml(m.content.replace(/\n/g, " ")) || "내용 없음"}</div>
      <div class="memo-item-date">${fmtDate(m.updated_at)}</div>
    `;
    li.addEventListener("click", () => openMemo(m.id));
    memoList.appendChild(li);
  });
}

function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ── Show / hide editor ── */
function showEditor() {
  emptyState.style.display = "none";
  editorEl.style.display = "flex";
}
function showEmpty() {
  emptyState.style.display = "";
  editorEl.style.display = "none";
  currentId = null;
  isNew = false;
}

/* ── Open existing memo ── */
function openMemo(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;
  currentId = id;
  isNew = false;
  titleInput.value = memo.title;
  contentInput.value = memo.content;
  memoMeta.textContent = `생성: ${fmtDate(memo.created_at)} · 수정: ${fmtDate(memo.updated_at)}`;
  showEditor();
  renderList(searchInput.value);
}

/* ── New memo ── */
document.getElementById("btn-new").addEventListener("click", () => {
  currentId = null;
  isNew = true;
  titleInput.value = "";
  contentInput.value = "";
  memoMeta.textContent = "";
  showEditor();
  renderList(searchInput.value);
  titleInput.focus();
});

/* ── Cancel ── */
document.getElementById("btn-cancel").addEventListener("click", () => {
  showEmpty();
  renderList(searchInput.value);
});

/* ── Save ── */
document.getElementById("btn-save").addEventListener("click", saveMemo);

async function saveMemo() {
  const title = titleInput.value.trim();
  const content = contentInput.value;
  if (!title) { showToast("제목을 입력하세요."); titleInput.focus(); return; }

  try {
    if (isNew) {
      const created = await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({ title, content }),
      });
      memos.unshift(created);
      currentId = created.id;
      isNew = false;
      memoMeta.textContent = `생성: ${fmtDate(created.created_at)} · 수정: ${fmtDate(created.updated_at)}`;
      showToast("메모가 저장되었습니다.");
    } else {
      const updated = await apiFetch(`${API}/${currentId}`, {
        method: "PUT",
        body: JSON.stringify({ title, content }),
      });
      const idx = memos.findIndex(m => m.id === currentId);
      if (idx !== -1) memos[idx] = updated;
      memos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      memoMeta.textContent = `생성: ${fmtDate(updated.created_at)} · 수정: ${fmtDate(updated.updated_at)}`;
      showToast("저장되었습니다.");
    }
    renderList(searchInput.value);
  } catch (e) {
    showToast("저장 실패: " + e.message);
  }
}

/* ── Delete ── */
document.getElementById("btn-delete").addEventListener("click", async () => {
  if (isNew) { showEmpty(); renderList(searchInput.value); return; }
  if (!confirm("이 메모를 삭제하시겠습니까?")) return;
  try {
    await apiFetch(`${API}/${currentId}`, { method: "DELETE" });
    memos = memos.filter(m => m.id !== currentId);
    showEmpty();
    renderList(searchInput.value);
    showToast("삭제되었습니다.");
  } catch (e) {
    showToast("삭제 실패: " + e.message);
  }
});

/* ── Search ── */
searchInput.addEventListener("input", () => renderList(searchInput.value));

/* ── Ctrl+S ── */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (editorEl.style.display !== "none") saveMemo();
  }
});

/* ── Initial load ── */
async function init() {
  try {
    memos = await apiFetch(API);
    renderList();
  } catch (e) {
    memoList.innerHTML = `<li class="memo-list-empty">서버에 연결할 수 없습니다.</li>`;
  }
}

init();
