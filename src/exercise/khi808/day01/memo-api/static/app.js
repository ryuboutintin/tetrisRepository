'use strict';

const API = '/memos';

/* ── State ── */
let memos    = [];
let activeId = null;   // null: 새 메모, number: 기존 메모

/* ── DOM ── */
const sidebar      = document.getElementById('sidebar');
const editorPanel  = document.getElementById('editorPanel');
const memoList     = document.getElementById('memoList');
const emptyList    = document.getElementById('emptyList');
const emptyEditor  = document.getElementById('emptyEditor');
const memoForm     = document.getElementById('memoForm');
const inputTitle   = document.getElementById('inputTitle');
const inputContent = document.getElementById('inputContent');
const btnNew       = document.getElementById('btnNew');
const btnSave      = document.getElementById('btnSave');
const btnDelete    = document.getElementById('btnDelete');
const btnBack      = document.getElementById('btnBack');
const searchInput  = document.getElementById('searchInput');
const formBadge    = document.getElementById('formBadge');
const toast        = document.getElementById('toast');

/* ── API helpers ── */
async function request(method, path = '', body = null) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '오류가 발생했습니다.');
  return data;
}

/* ── Toast ── */
let toastTimer;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 2500);
}

/* ── Render list ── */
function renderList() {
  const kw       = searchInput.value.toLowerCase();
  const filtered = kw
    ? memos.filter(m =>
        m.title.toLowerCase().includes(kw) ||
        m.content.toLowerCase().includes(kw))
    : memos;

  memoList.innerHTML = '';
  emptyList.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(m => {
    const li = document.createElement('li');
    li.className = 'memo-item' + (m.id === activeId ? ' active' : '');
    li.innerHTML = `
      <span class="item-title">${esc(m.title)}</span>
      <span class="item-preview">${esc(m.content.slice(0, 60))}</span>
      <span class="item-date">${fmtDate(m.updated_at)}</span>
    `;
    li.addEventListener('click', () => openMemo(m.id));
    memoList.appendChild(li);
  });
}

/* ── Open existing memo ── */
function openMemo(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;
  activeId = id;

  inputTitle.value   = memo.title;
  inputContent.value = memo.content;
  formBadge.textContent   = '메모 수정';
  btnSave.textContent     = '수정';
  btnDelete.classList.remove('hidden');

  showEditorPanel();
  renderList();
}

/* ── New memo mode ── */
function startNewMemo() {
  activeId = null;
  memoForm.reset();
  formBadge.textContent  = '새 메모';
  btnSave.textContent    = '저장';
  btnDelete.classList.add('hidden');

  showEditorPanel();
  renderList();
  inputTitle.focus();
}

/* ── Panel switching (mobile) ── */
function isMobile() { return window.innerWidth <= 640; }

function showEditorPanel() {
  emptyEditor.classList.add('hidden');
  memoForm.classList.remove('hidden');
  if (isMobile()) {
    sidebar.classList.add('hidden');
    editorPanel.classList.remove('hidden');
  }
}

function showSidebar() {
  if (isMobile()) {
    editorPanel.classList.add('hidden');
    sidebar.classList.remove('hidden');
  }
}

/* ── Load all memos ── */
async function loadMemos() {
  try {
    memos = await request('GET');
    renderList();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

/* ── Create / Update ── */
memoForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    title:   inputTitle.value.trim(),
    content: inputContent.value.trim(),
  };
  if (!data.title || !data.content) {
    showToast('제목과 내용을 모두 입력하세요.', 'error');
    return;
  }

  try {
    if (activeId === null) {
      const created = await request('POST', '', data);
      memos.unshift(created);
      activeId = created.id;
      formBadge.textContent = '메모 수정';
      btnSave.textContent   = '수정';
      btnDelete.classList.remove('hidden');
      showToast('메모가 생성됐습니다.');
    } else {
      const updated = await request('PUT', `/${activeId}`, data);
      const idx = memos.findIndex(m => m.id === activeId);
      if (idx !== -1) memos[idx] = updated;
      showToast('메모가 수정됐습니다.');
    }
    renderList();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

/* ── Delete ── */
btnDelete.addEventListener('click', async () => {
  if (!confirm('이 메모를 삭제할까요?')) return;
  try {
    await request('DELETE', `/${activeId}`);
    memos = memos.filter(m => m.id !== activeId);
    activeId = null;

    memoForm.classList.add('hidden');
    emptyEditor.classList.remove('hidden');
    renderList();
    showToast('메모가 삭제됐습니다.');
    showSidebar();
  } catch (e) {
    showToast(e.message, 'error');
  }
});

/* ── Event bindings ── */
btnNew.addEventListener('click', startNewMemo);
btnBack.addEventListener('click', showSidebar);
searchInput.addEventListener('input', renderList);

/* ── Utilities ── */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtDate(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/* ── Init ── */
loadMemos();
