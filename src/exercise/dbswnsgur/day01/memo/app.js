const API = 'http://localhost:8000';

// ── 토큰 관리 ─────────────────────────────────────────

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function clearToken() { localStorage.removeItem('token'); }

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    logout();
    return null;
  }
  return res;
}

// ── 인증 화면 전환 ────────────────────────────────────

const authView  = document.getElementById('auth-view');
const memoView  = document.getElementById('memo-view');
const authError = document.getElementById('auth-error');
const authForm  = document.getElementById('auth-form');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authSubmit = document.getElementById('auth-submit');
const headerUsername = document.getElementById('header-username');

let currentTab = 'login';

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  authSubmit.textContent = tab === 'login' ? '로그인' : '회원가입';
  hideAuthError();
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function hideAuthError() {
  authError.classList.add('hidden');
}

function showAuthView() {
  authView.classList.remove('hidden');
  memoView.classList.add('hidden');
  authUsernameInput.value = '';
  authPasswordInput.value = '';
  hideAuthError();
}

function showMemoView(username) {
  authView.classList.add('hidden');
  memoView.classList.remove('hidden');
  headerUsername.textContent = username;
  loadAndRender();
}

function logout() {
  clearToken();
  showAuthView();
}

// ── 인증 API ──────────────────────────────────────────

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;
  if (!username || !password) return;

  hideAuthError();
  authSubmit.disabled = true;

  try {
    if (currentTab === 'login') {
      await doLogin(username, password);
    } else {
      await doRegister(username, password);
    }
  } finally {
    authSubmit.disabled = false;
  }
});

async function doLogin(username, password) {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    showAuthError(data.detail || '로그인에 실패했습니다');
    return;
  }
  setToken(data.access_token);
  showMemoView(data.username);
}

async function doRegister(username, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    showAuthError(data.detail || '회원가입에 실패했습니다');
    return;
  }
  setToken(data.access_token);
  showMemoView(data.username);
}

// ── 메모 API ─────────────────────────────────────────

async function fetchMemos(category = '', tag = '') {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (tag) params.set('tag', tag);
  const qs = params.toString() ? `?${params}` : '';
  const res = await apiFetch(`${API}/memos${qs}`, { headers: authHeaders() });
  if (!res) return [];
  return res.json();
}

async function fetchCategories() {
  const res = await apiFetch(`${API}/categories`, { headers: authHeaders() });
  if (!res) return [];
  return res.json();
}

async function fetchTags() {
  const res = await apiFetch(`${API}/tags`, { headers: authHeaders() });
  if (!res) return [];
  return res.json();
}

async function createMemo(title, content, category, tags) {
  const res = await apiFetch(`${API}/memos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content, category, tags }),
  });
  if (!res) return null;
  return res.json();
}

async function updateMemo(id, title, content, category, tags) {
  const res = await apiFetch(`${API}/memos/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title, content, category, tags }),
  });
  if (!res) return null;
  return res.json();
}

async function deleteMemo(id) {
  await apiFetch(`${API}/memos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

// ── DOM 요소 ─────────────────────────────────────────

const inputTitle    = document.getElementById('input-title');
const inputContent  = document.getElementById('input-content');
const inputCategory = document.getElementById('input-category');
const inputTags     = document.getElementById('input-tags');
const btnSubmit     = document.getElementById('btn-submit');
const btnCancel     = document.getElementById('btn-cancel');
const memoList      = document.getElementById('memo-list');
const emptyMsg      = document.getElementById('empty-msg');
const overlay       = document.getElementById('modal-overlay');
const modalCancel   = document.getElementById('modal-cancel');
const modalConfirm  = document.getElementById('modal-confirm');
const filterCategory = document.getElementById('filter-category');
const filterTag      = document.getElementById('filter-tag');
const btnFilterClear = document.getElementById('btn-filter-clear');

let editingId  = null;
let deletingId = null;

// ── 필터 ────────────────────────────────────────────

async function refreshFilterUI() {
  const [categories] = await Promise.all([fetchCategories()]);
  const current = filterCategory.value;
  filterCategory.innerHTML = '<option value="">전체 카테고리</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === current) opt.selected = true;
    filterCategory.appendChild(opt);
  });
}

function getActiveFilters() {
  return {
    category: filterCategory.value,
    tag: filterTag.value.trim(),
  };
}

function updateFilterClearBtn() {
  const { category, tag } = getActiveFilters();
  btnFilterClear.classList.toggle('hidden', !category && !tag);
}

filterCategory.addEventListener('change', () => {
  updateFilterClearBtn();
  loadAndRender();
});

let filterTagTimer = null;
filterTag.addEventListener('input', () => {
  clearTimeout(filterTagTimer);
  filterTagTimer = setTimeout(() => {
    updateFilterClearBtn();
    loadAndRender();
  }, 300);
});

btnFilterClear.addEventListener('click', () => {
  filterCategory.value = '';
  filterTag.value = '';
  updateFilterClearBtn();
  loadAndRender();
});

// ── 렌더링 ───────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function parseTags(tagsStr) {
  return tagsStr.split(',').map(t => t.trim()).filter(Boolean);
}

function renderMemos(memos) {
  memoList.innerHTML = '';
  if (memos.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');
  memos.forEach(memo => memoList.appendChild(createCard(memo)));
}

function createCard(memo) {
  const card = document.createElement('div');
  card.className = 'memo-card';
  card.dataset.id = memo.id;

  const categoryBadge = memo.category
    ? `<span class="category-badge">${escapeHtml(memo.category)}</span>`
    : '';

  const tagChips = parseTags(memo.tags)
    .map(t => `<span class="tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
    .join('');

  const metaRow = (categoryBadge || tagChips)
    ? `<div class="memo-meta">${categoryBadge}<div class="tag-list">${tagChips}</div></div>`
    : '';

  card.innerHTML = `
    <div class="memo-header">
      <span class="memo-title">${escapeHtml(memo.title)}</span>
      <div class="memo-card-actions">
        <button class="icon-btn edit" title="수정">✏️</button>
        <button class="icon-btn delete" title="삭제">🗑️</button>
      </div>
    </div>
    ${metaRow}
    <p class="memo-content">${escapeHtml(memo.content)}</p>
    <span class="memo-date">수정: ${formatDate(memo.updated_at)}</span>
  `;

  card.querySelector('.edit').addEventListener('click', () => startInlineEdit(card, memo));
  card.querySelector('.delete').addEventListener('click', () => openDeleteModal(memo.id));

  card.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      filterTag.value = chip.dataset.tag;
      updateFilterClearBtn();
      loadAndRender();
    });
  });

  return card;
}

// ── 인라인 편집 ──────────────────────────────────────

function startInlineEdit(card, memo) {
  cancelInlineEdit();
  editingId = memo.id;
  card.classList.add('editing');

  card.innerHTML = `
    <input class="edit-input" value="${escapeHtml(memo.title)}" maxlength="100" />
    <textarea class="edit-textarea" rows="4">${escapeHtml(memo.content)}</textarea>
    <div class="edit-meta">
      <input class="edit-category" type="text" placeholder="카테고리" maxlength="50" value="${escapeHtml(memo.category)}" />
      <input class="edit-tags" type="text" placeholder="태그 (쉼표로 구분)" value="${escapeHtml(memo.tags)}" />
    </div>
    <div class="edit-actions">
      <button class="btn btn-secondary" id="inline-cancel">취소</button>
      <button class="btn btn-primary" id="inline-save">저장</button>
    </div>
  `;

  const titleInput    = card.querySelector('.edit-input');
  const contentInput  = card.querySelector('.edit-textarea');
  const categoryInput = card.querySelector('.edit-category');
  const tagsInput     = card.querySelector('.edit-tags');
  titleInput.focus();
  titleInput.select();

  card.querySelector('#inline-cancel').addEventListener('click', () => {
    editingId = null;
    loadAndRender();
  });

  card.querySelector('#inline-save').addEventListener('click', async () => {
    const newTitle    = titleInput.value.trim();
    const newContent  = contentInput.value.trim();
    const newCategory = categoryInput.value.trim();
    const newTags     = tagsInput.value.trim();
    if (!newTitle) { titleInput.focus(); return; }
    await updateMemo(memo.id, newTitle, newContent, newCategory, newTags);
    editingId = null;
    await refreshFilterUI();
    loadAndRender();
  });
}

function cancelInlineEdit() {
  if (editingId !== null) {
    editingId = null;
    loadAndRender();
  }
}

// ── 삭제 모달 ────────────────────────────────────────

function openDeleteModal(id) {
  deletingId = id;
  overlay.classList.remove('hidden');
}

function closeDeleteModal() {
  deletingId = null;
  overlay.classList.add('hidden');
}

modalCancel.addEventListener('click', closeDeleteModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeDeleteModal(); });

modalConfirm.addEventListener('click', async () => {
  if (deletingId === null) return;
  await deleteMemo(deletingId);
  closeDeleteModal();
  await refreshFilterUI();
  loadAndRender();
});

// ── 폼 ──────────────────────────────────────────────

btnSubmit.addEventListener('click', async () => {
  const title    = inputTitle.value.trim();
  const content  = inputContent.value.trim();
  const category = inputCategory.value.trim();
  const tags     = inputTags.value.trim();
  if (!title) { inputTitle.focus(); return; }
  await createMemo(title, content, category, tags);
  inputTitle.value    = '';
  inputContent.value  = '';
  inputCategory.value = '';
  inputTags.value     = '';
  btnCancel.classList.add('hidden');
  await refreshFilterUI();
  loadAndRender();
});

btnCancel.addEventListener('click', () => {
  inputTitle.value    = '';
  inputContent.value  = '';
  inputCategory.value = '';
  inputTags.value     = '';
  btnCancel.classList.add('hidden');
});

[inputTitle, inputContent, inputCategory, inputTags].forEach(el => {
  el.addEventListener('input', () => {
    const hasInput = inputTitle.value || inputContent.value || inputCategory.value || inputTags.value;
    btnCancel.classList.toggle('hidden', !hasInput);
  });
});

inputTitle.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); inputContent.focus(); }
});

inputContent.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) btnSubmit.click();
});

document.getElementById('btn-logout').addEventListener('click', logout);

// ── 초기 로드 ────────────────────────────────────────

async function loadAndRender() {
  const { category, tag } = getActiveFilters();
  const memos = await fetchMemos(category, tag);
  renderMemos(memos);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function init() {
  const token = getToken();
  if (!token) {
    showAuthView();
    return;
  }
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    clearToken();
    showAuthView();
    return;
  }
  const user = await res.json();
  await refreshFilterUI();
  showMemoView(user.username);
}

init();
