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

// 401 응답 시 자동 로그아웃
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

async function fetchMemos() {
  const res = await apiFetch(`${API}/memos`, { headers: authHeaders() });
  if (!res) return [];
  return res.json();
}

async function createMemo(title, content) {
  const res = await apiFetch(`${API}/memos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
  });
  if (!res) return null;
  return res.json();
}

async function updateMemo(id, title, content) {
  const res = await apiFetch(`${API}/memos/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
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

const inputTitle   = document.getElementById('input-title');
const inputContent = document.getElementById('input-content');
const btnSubmit    = document.getElementById('btn-submit');
const btnCancel    = document.getElementById('btn-cancel');
const memoList     = document.getElementById('memo-list');
const emptyMsg     = document.getElementById('empty-msg');
const overlay      = document.getElementById('modal-overlay');
const modalCancel  = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

let editingId  = null;
let deletingId = null;

// ── 렌더링 ───────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
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

  card.innerHTML = `
    <div class="memo-header">
      <span class="memo-title">${escapeHtml(memo.title)}</span>
      <div class="memo-card-actions">
        <button class="icon-btn edit" title="수정">✏️</button>
        <button class="icon-btn delete" title="삭제">🗑️</button>
      </div>
    </div>
    <p class="memo-content">${escapeHtml(memo.content)}</p>
    <span class="memo-date">수정: ${formatDate(memo.updated_at)}</span>
  `;

  card.querySelector('.edit').addEventListener('click', () => startInlineEdit(card, memo));
  card.querySelector('.delete').addEventListener('click', () => openDeleteModal(memo.id));

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
    <div class="edit-actions">
      <button class="btn btn-secondary" id="inline-cancel">취소</button>
      <button class="btn btn-primary" id="inline-save">저장</button>
    </div>
  `;

  const titleInput   = card.querySelector('.edit-input');
  const contentInput = card.querySelector('.edit-textarea');
  titleInput.focus();
  titleInput.select();

  card.querySelector('#inline-cancel').addEventListener('click', () => {
    editingId = null;
    loadAndRender();
  });

  card.querySelector('#inline-save').addEventListener('click', async () => {
    const newTitle   = titleInput.value.trim();
    const newContent = contentInput.value.trim();
    if (!newTitle) { titleInput.focus(); return; }
    await updateMemo(memo.id, newTitle, newContent);
    editingId = null;
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
  loadAndRender();
});

// ── 폼 ──────────────────────────────────────────────

btnSubmit.addEventListener('click', async () => {
  const title   = inputTitle.value.trim();
  const content = inputContent.value.trim();
  if (!title) { inputTitle.focus(); return; }
  await createMemo(title, content);
  inputTitle.value   = '';
  inputContent.value = '';
  loadAndRender();
});

btnCancel.addEventListener('click', () => {
  inputTitle.value   = '';
  inputContent.value = '';
  btnCancel.classList.add('hidden');
});

[inputTitle, inputContent].forEach(el => {
  el.addEventListener('input', () => {
    btnCancel.classList.toggle('hidden', !inputTitle.value && !inputContent.value);
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
  const memos = await fetchMemos();
  renderMemos(memos);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 토큰이 있으면 /auth/me로 사용자 정보 확인 후 메모 화면 진입
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
  showMemoView(user.username);
}

init();
