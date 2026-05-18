const API = 'http://localhost:8000';

let memos = [];
let currentId = null;
let isNew = false;

const memoList    = document.getElementById('memoList');
const emptyMsg    = document.getElementById('emptyMsg');
const editForm    = document.getElementById('editForm');
const placeholder = document.getElementById('placeholder');
const titleInput  = document.getElementById('titleInput');
const contentInput= document.getElementById('contentInput');
const tagsInput   = document.getElementById('tagsInput');
const saveBtn     = document.getElementById('saveBtn');
const deleteBtn   = document.getElementById('deleteBtn');
const themeToggle = document.getElementById('themeToggle');
const toast       = document.getElementById('toast');

// ── 테마 ──────────────────────────────────────
const THEME_KEY = 'memo-theme';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});
applyTheme(localStorage.getItem(THEME_KEY) || 'light');

// ── 토스트 ────────────────────────────────────
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── API 호출 ──────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── 목록 렌더링 ───────────────────────────────
function renderList() {
  memoList.innerHTML = '';
  const show = memos.length > 0;
  emptyMsg.classList.toggle('hidden', show);

  memos.forEach(m => {
    const li = document.createElement('li');
    li.className = 'memo-item' + (m.id === currentId ? ' active' : '');
    li.dataset.id = m.id;

    const date = new Date(m.updated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    const firstLine = m.content.split('\n')[0].trim();
    const title = m.title || firstLine.slice(0, 32) || '빈 메모';
    const preview = m.title ? firstLine : (m.content.split('\n').slice(1).join(' ').trim() || firstLine);

    li.innerHTML = `
      <div class="item-header">
        <span class="item-title">${title}</span>
        <span class="item-date">${date}</span>
      </div>
      <div class="item-preview">${preview}</div>
    `;
    li.addEventListener('click', () => selectMemo(m.id));
    memoList.appendChild(li);
  });
}

// ── 편집 패널 열기 ────────────────────────────
function openEditor(memo) {
  placeholder.classList.add('hidden');
  editForm.classList.remove('hidden');
  titleInput.value   = memo.title   || '';
  contentInput.value = memo.content || '';
  tagsInput.value    = (memo.tags   || []).join(', ');
  deleteBtn.style.display = isNew ? 'none' : '';
  if (isNew) titleInput.focus(); else contentInput.focus();
}

function closeEditor() {
  placeholder.classList.remove('hidden');
  editForm.classList.add('hidden');
  currentId = null;
  isNew = false;
  renderList();
}

// ── 메모 선택 ─────────────────────────────────
function selectMemo(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;
  currentId = id;
  isNew = false;
  renderList();
  openEditor(memo);
}

// ── 로드 ──────────────────────────────────────
async function loadMemos() {
  try {
    memos = await apiFetch('/memos');
    renderList();
  } catch (e) {
    showToast('서버 연결 실패: ' + e.message);
  }
}

// ── 새 메모 ───────────────────────────────────
document.getElementById('newMemoBtn').addEventListener('click', () => {
  currentId = null;
  isNew = true;
  renderList();
  openEditor({ title: '', content: '', tags: [] });
});

// ── 저장 ──────────────────────────────────────
editForm.addEventListener('submit', async e => {
  e.preventDefault();
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  const payload = {
    content: contentInput.value.trim(),
    title: titleInput.value.trim() || null,
    tags,
  };
  if (!payload.content) { showToast('내용을 입력해주세요.'); return; }

  try {
    if (isNew) {
      const created = await apiFetch('/memos', { method: 'POST', body: JSON.stringify(payload) });
      memos.unshift(created);
      currentId = created.id;
      isNew = false;
      showToast('메모가 저장되었습니다.');
    } else {
      const updated = await apiFetch(`/memos/${currentId}`, { method: 'PUT', body: JSON.stringify(payload) });
      memos = memos.map(m => m.id === currentId ? updated : m);
      showToast('메모가 수정되었습니다.');
    }
    renderList();
    deleteBtn.style.display = 'inline-block';
  } catch (e) {
    showToast('오류: ' + e.message);
  }
});

// ── 삭제 ──────────────────────────────────────
deleteBtn.addEventListener('click', async () => {
  if (!currentId) return;
  if (!confirm('메모를 삭제할까요?')) return;
  try {
    await apiFetch(`/memos/${currentId}`, { method: 'DELETE' });
    memos = memos.filter(m => m.id !== currentId);
    showToast('메모가 삭제되었습니다.');
    closeEditor();
  } catch (e) {
    showToast('오류: ' + e.message);
  }
});

// ── 초기화 ────────────────────────────────────
loadMemos();
