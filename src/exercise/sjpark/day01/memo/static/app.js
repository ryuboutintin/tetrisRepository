// ── 인증 ────────────────────────────────────────────────────────────
let currentTab = 'login';

function getToken() { return localStorage.getItem('memo_token'); }
function setToken(t) { localStorage.setItem('memo_token', t); }
function clearToken() { localStorage.removeItem('memo_token'); }

function authHeaders(isForm = false) {
  const h = { Authorization: `Bearer ${getToken()}` };
  if (!isForm) h['Content-Type'] = 'application/json';
  return h;
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (res.status === 401) { logout(); return null; }
  return res;
}

function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-submit-btn').textContent = tab === 'login' ? '로그인' : '회원가입';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
}

async function submitAuth(e) {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.style.display = 'none';

  try {
    if (currentTab === 'register') {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      switchTab('login');
      showToast('회원가입 완료! 로그인해주세요.');
      return;
    }

    // 로그인
    const res = await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
    const data = await res.json();
    setToken(data.access_token);
    showApp(username);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

function showApp(username) {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('header-username').textContent = username;
  fetchMemos();
}

function logout() {
  clearToken();
  currentId = null;
  memos = [];
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('view-pane').style.display = 'none';
  document.getElementById('edit-pane').style.display = 'none';
  document.getElementById('placeholder').style.display = 'flex';
  document.getElementById('memo-list').innerHTML = '';
  document.getElementById('header-username').textContent = '';
  switchTab('login');
}

// ── 초기화 ───────────────────────────────────────────────────────────
(function init() {
  const token = getToken();
  if (!token) return; // 오버레이 표시 유지

  // 토큰이 있으면 사용자 정보 확인 후 앱 표시
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) { clearToken(); return; }
    showApp(payload.sub);
  } catch {
    clearToken();
  }
})();

// ── 메모 ─────────────────────────────────────────────────────────────
let memos = [];
let currentId = null;

async function fetchMemos() {
  const res = await apiFetch('/memos');
  if (!res) return;
  memos = await res.json();
  renderList();
}

function renderList() {
  const list = document.getElementById('memo-list');
  if (memos.length === 0) {
    list.innerHTML = '<p class="empty-list">메모가 없습니다.</p>';
    return;
  }
  list.innerHTML = memos.map(m => `
    <div class="memo-item ${m.id === currentId ? 'active' : ''}" onclick="selectMemo(${m.id})">
      <div class="item-title">${escHtml(m.title) || '(제목 없음)'}</div>
      ${m.content ? `<div class="item-preview">${escHtml(m.content)}</div>` : ''}
      <div class="item-date">${formatDate(m.updated_at)}</div>
    </div>
  `).join('');
}

function selectMemo(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;
  currentId = id;
  showViewPane(memo);
  renderList();
}

function showViewPane(memo) {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('edit-pane').style.display = 'none';
  const vp = document.getElementById('view-pane');
  vp.style.display = 'flex';
  document.getElementById('view-title').textContent = memo.title || '(제목 없음)';
  document.getElementById('view-content').textContent = memo.content;
}

function startEdit() {
  const memo = memos.find(m => m.id === currentId);
  if (!memo) return;
  document.getElementById('view-pane').style.display = 'none';
  const ep = document.getElementById('edit-pane');
  ep.style.display = 'flex';
  document.getElementById('title-input').value = memo.title;
  document.getElementById('content-input').value = memo.content;
  document.getElementById('title-input').focus();
}

function newMemo() {
  currentId = null;
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('view-pane').style.display = 'none';
  const ep = document.getElementById('edit-pane');
  ep.style.display = 'flex';
  document.getElementById('title-input').value = '';
  document.getElementById('content-input').value = '';
  document.getElementById('title-input').focus();
  renderList();
}

function cancelEdit() {
  if (currentId !== null) {
    const memo = memos.find(m => m.id === currentId);
    if (memo) { showViewPane(memo); return; }
  }
  document.getElementById('edit-pane').style.display = 'none';
  document.getElementById('placeholder').style.display = 'flex';
}

async function saveMemo() {
  const title = document.getElementById('title-input').value.trim();
  const content = document.getElementById('content-input').value;
  if (!title) { showToast('제목을 입력하세요.'); return; }

  let saved;
  if (currentId === null) {
    const res = await apiFetch('/memos', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    });
    if (!res) return;
    saved = await res.json();
    currentId = saved.id;
  } else {
    const res = await apiFetch(`/memos/${currentId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, content }),
    });
    if (!res) return;
    saved = await res.json();
  }

  await fetchMemos();
  showViewPane(saved);
  showToast('저장했습니다.');
}

async function deleteMemo() {
  if (!currentId) return;
  if (!confirm('이 메모를 삭제하시겠습니까?')) return;
  await apiFetch(`/memos/${currentId}`, { method: 'DELETE' });
  currentId = null;
  document.getElementById('view-pane').style.display = 'none';
  document.getElementById('edit-pane').style.display = 'none';
  document.getElementById('placeholder').style.display = 'flex';
  await fetchMemos();
  showToast('삭제했습니다.');
}

// ── 유틸 ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
