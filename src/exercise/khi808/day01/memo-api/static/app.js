'use strict';

const API       = '/memos';
const TOKEN_KEY = 'memo_token';
const USER_KEY  = 'memo_username';

/* ── State ── */
let memos    = [];
let activeId = null;

/* ── DOM — Auth ── */
const authWrap       = document.getElementById('authWrap');
const loginForm      = document.getElementById('loginForm');
const registerForm   = document.getElementById('registerForm');
const loginError     = document.getElementById('loginError');
const registerError  = document.getElementById('registerError');
const registerSuccess= document.getElementById('registerSuccess');

/* ── DOM — App ── */
const app          = document.getElementById('app');
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
const btnLogout    = document.getElementById('btnLogout');
const searchInput  = document.getElementById('searchInput');
const formBadge    = document.getElementById('formBadge');
const usernameBadge= document.getElementById('usernameBadge');
const toast        = document.getElementById('toast');

/* ── Token helpers ── */
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearAuth = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

/* ── API helpers ── */
async function request(method, path = '', body = null, auth = true) {
  const headers = {};
  if (body)  headers['Content-Type'] = 'application/json';
  if (auth)  headers['Authorization'] = `Bearer ${getToken()}`;

  const res = await fetch(API.replace('/memos', '') + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '오류가 발생했습니다.');
  return data;
}

const authRequest = (method, path, body) => request(method, path, body, false);
const memoRequest = (method, path, body) => request(method, `/memos${path}`, body, true);

/* ── Toast ── */
let toastTimer;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 2500);
}

/* ── Auth tab switch ── */
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  loginForm.classList.toggle('hidden', !isLogin);
  registerForm.classList.toggle('hidden', isLogin);
  loginError.classList.add('hidden');
  registerError.classList.add('hidden');
  registerSuccess.classList.add('hidden');
}

/* ── Show auth / app ── */
function showAuth() {
  authWrap.classList.remove('hidden');
  app.classList.add('hidden');
}

function showApp(username) {
  authWrap.classList.add('hidden');
  app.classList.remove('hidden');
  usernameBadge.textContent = `👤 ${username}`;
  loadMemos();
}

/* ── Login ── */
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  try {
    const data = await authRequest('POST', '/auth/login', { username, password });
    setToken(data.access_token);
    localStorage.setItem(USER_KEY, username);
    loginForm.reset();
    showApp(username);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

/* ── Register ── */
registerForm.addEventListener('submit', async e => {
  e.preventDefault();
  registerError.classList.add('hidden');
  registerSuccess.classList.add('hidden');
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  try {
    await authRequest('POST', '/auth/register', { username, password });
    registerSuccess.textContent = '가입 완료! 로그인해 주세요.';
    registerSuccess.classList.remove('hidden');
    registerForm.reset();
    setTimeout(() => switchAuthTab('login'), 1200);
  } catch (err) {
    registerError.textContent = err.message;
    registerError.classList.remove('hidden');
  }
});

/* ── Logout ── */
btnLogout.addEventListener('click', () => {
  clearAuth();
  memos    = [];
  activeId = null;
  memoForm.classList.add('hidden');
  emptyEditor.classList.remove('hidden');
  showAuth();
});

/* ── Render list ── */
function renderList() {
  const kw       = searchInput.value.toLowerCase();
  const filtered = kw
    ? memos.filter(m => m.title.toLowerCase().includes(kw) || m.content.toLowerCase().includes(kw))
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
  formBadge.textContent = '메모 수정';
  btnSave.textContent   = '수정';
  btnDelete.classList.remove('hidden');
  showEditorPanel();
  renderList();
}

/* ── New memo ── */
function startNewMemo() {
  activeId = null;
  memoForm.reset();
  formBadge.textContent = '새 메모';
  btnSave.textContent   = '저장';
  btnDelete.classList.add('hidden');
  showEditorPanel();
  renderList();
  inputTitle.focus();
}

/* ── Panel switching ── */
const isMobile = () => window.innerWidth <= 640;

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

/* ── Load memos ── */
async function loadMemos() {
  try {
    memos = await memoRequest('GET', '');
    renderList();
  } catch (err) {
    if (err.message.includes('토큰')) { clearAuth(); showAuth(); }
    else showToast(err.message, 'error');
  }
}

/* ── Create / Update ── */
memoForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = { title: inputTitle.value.trim(), content: inputContent.value.trim() };
  if (!data.title || !data.content) { showToast('제목과 내용을 모두 입력하세요.', 'error'); return; }

  try {
    if (activeId === null) {
      const created = await memoRequest('POST', '', data);
      memos.unshift(created);
      activeId = created.id;
      formBadge.textContent = '메모 수정';
      btnSave.textContent   = '수정';
      btnDelete.classList.remove('hidden');
      showToast('메모가 생성됐습니다.');
    } else {
      const updated = await memoRequest('PUT', `/${activeId}`, data);
      const idx = memos.findIndex(m => m.id === activeId);
      if (idx !== -1) memos[idx] = updated;
      showToast('메모가 수정됐습니다.');
    }
    renderList();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ── Delete ── */
btnDelete.addEventListener('click', async () => {
  if (!confirm('이 메모를 삭제할까요?')) return;
  try {
    await memoRequest('DELETE', `/${activeId}`);
    memos = memos.filter(m => m.id !== activeId);
    activeId = null;
    memoForm.classList.add('hidden');
    emptyEditor.classList.remove('hidden');
    renderList();
    showToast('메모가 삭제됐습니다.');
    showSidebar();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ── Event bindings ── */
btnNew.addEventListener('click', startNewMemo);
btnBack.addEventListener('click', showSidebar);
searchInput.addEventListener('input', renderList);

/* ── Utils ── */
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

/* ── Init ── */
const savedToken    = getToken();
const savedUsername = localStorage.getItem(USER_KEY);
if (savedToken && savedUsername) {
  showApp(savedUsername);
} else {
  showAuth();
}
