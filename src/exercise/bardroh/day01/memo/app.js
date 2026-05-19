// ── 상수 ──────────────────────────────────────────────────
const API = '/memos';
const CATEGORY_META = {
  '업무':    { label: '업무' },
  '개인':    { label: '개인' },
  '아이디어': { label: '아이디어' },
  '기타':    { label: '기타' },
};

// ── 필터 상태 ─────────────────────────────────────────────
let allMemos = [];
let activeCategory = '';
let activeTags = new Set();

// ── 토큰 관리 ─────────────────────────────────────────────

function getAccessToken()  { return localStorage.getItem('access_token'); }
function getRefreshToken() { return localStorage.getItem('refresh_token'); }

function saveTokens(access, refresh) {
  localStorage.setItem('access_token', access);
  if (refresh !== null) localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// ── 인증 포함 fetch 래퍼 ──────────────────────────────────

async function authFetch(url, options = {}) {
  options.headers = { ...options.headers, 'Authorization': `Bearer ${getAccessToken()}` };
  let res = await fetch(url, options);
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (!ok) { showAuth(); return null; }
    options.headers['Authorization'] = `Bearer ${getAccessToken()}`;
    res = await fetch(url, options);
  }
  return res;
}

async function tryRefresh() {
  const token = getRefreshToken();
  if (!token) return false;
  const res = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: token }),
  });
  if (!res.ok) { clearTokens(); return false; }
  const data = await res.json();
  saveTokens(data.access_token, null);
  return true;
}

// ── 인증 API ──────────────────────────────────────────────

async function apiLogin(username, password) {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}

async function apiRegister(username, email, password) {
  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  return res.json();
}

async function apiLogout() {
  const token = getRefreshToken();
  if (token) {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }),
    });
  }
  clearTokens();
}

// ── 메모 API ──────────────────────────────────────────────

async function fetchMemos() {
  const res = await authFetch(API);
  if (!res) return [];
  return res.json();
}

async function createMemo(title, content, category, tags) {
  const res = await authFetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, category: category || null, tags }),
  });
  if (!res) return null;
  return res.json();
}

async function updateMemo(id, title, content, category, tags) {
  const res = await authFetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, category: category || null, tags }),
  });
  if (!res) return null;
  return res.json();
}

async function deleteMemo(id) {
  await authFetch(`${API}/${id}`, { method: 'DELETE' });
}

// ── 필터 로직 ─────────────────────────────────────────────

function applyFilters(memos) {
  return memos.filter(memo => {
    if (activeCategory === '__uncat__' && memo.category) return false;
    if (activeCategory && activeCategory !== '__uncat__' && memo.category !== activeCategory) return false;
    if (activeTags.size > 0) {
      const memoTagSet = new Set(memo.tags);
      for (const tag of activeTags) {
        if (!memoTagSet.has(tag)) return false;
      }
    }
    return true;
  });
}

function addTagFilter(tag) {
  activeTags.add(tag);
  renderMemos(applyFilters(allMemos));
  renderActiveTags();
}

function removeTagFilter(tag) {
  activeTags.delete(tag);
  renderMemos(applyFilters(allMemos));
  renderActiveTags();
}

// ── 화면 전환 ─────────────────────────────────────────────

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('memo-screen').classList.add('hidden');
  document.getElementById('user-info').classList.add('hidden');
}

function showMemo(username) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('memo-screen').classList.remove('hidden');
  document.getElementById('user-info').classList.remove('hidden');
  document.getElementById('username-display').textContent = username;
}

// ── 렌더링 ────────────────────────────────────────────────

function renderMemos(memos) {
  const list  = document.getElementById('memo-list');
  const empty = document.getElementById('empty-msg');
  const count = document.getElementById('memo-count');

  list.innerHTML = '';
  count.textContent = memos.length ? `(${memos.length})` : '';

  if (memos.length === 0) {
    empty.classList.add('visible');
    return;
  }
  empty.classList.remove('visible');
  memos.forEach(memo => list.appendChild(buildCard(memo)));
}

function renderActiveTags() {
  const container = document.getElementById('active-tags');
  container.innerHTML = '';
  activeTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'active-tag-chip';
    chip.innerHTML = `#${escapeHtml(tag)}<button class="chip-remove" title="필터 제거">×</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', () => removeTagFilter(tag));
    container.appendChild(chip);
  });
}

function buildCard(memo) {
  const card = document.createElement('div');
  card.className = 'memo-card';
  card.dataset.id = memo.id;

  // 카테고리 배지
  const catHtml = memo.category
    ? `<span class="cat-badge cat-badge--${slugify(memo.category)}">${escapeHtml(memo.category)}</span>`
    : '';

  // 태그 칩
  const tagsHtml = memo.tags.length
    ? memo.tags.map(t =>
        `<span class="tag-chip" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`
      ).join('')
    : '';

  card.innerHTML = `
    <div class="card-header">${catHtml}</div>
    <div class="card-title">${escapeHtml(memo.title)}</div>
    <div class="card-content">${escapeHtml(memo.content)}</div>
    <div class="card-tags">${tagsHtml}</div>
    <div class="card-actions">
      <button class="btn btn-edit" data-action="edit">수정</button>
      <button class="btn btn-delete" data-action="delete">삭제</button>
    </div>
  `;

  // 태그 클릭 → 필터 추가
  card.querySelectorAll('.tag-chip').forEach(el => {
    el.addEventListener('click', () => addTagFilter(el.dataset.tag));
  });

  card.querySelector('[data-action="edit"]').addEventListener('click', () => {
    switchToEditMode(card, memo);
  });
  card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    await deleteMemo(memo.id);
    await reload();
  });

  return card;
}

function buildCategoryOptions(selected) {
  const opts = [{ value: '', label: '카테고리 없음' },
                { value: '업무',    label: '업무' },
                { value: '개인',    label: '개인' },
                { value: '아이디어', label: '아이디어' },
                { value: '기타',    label: '기타' }];
  return opts.map(o =>
    `<option value="${o.value}" ${selected === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');
}

function switchToEditMode(card, memo) {
  card.classList.add('editing');
  card.innerHTML = `
    <form>
      <input type="text" class="edit-title" value="${escapeHtml(memo.title)}" required>
      <textarea class="edit-content" rows="4" required>${escapeHtml(memo.content)}</textarea>
      <select class="edit-category">${buildCategoryOptions(memo.category || '')}</select>
      <input type="text" class="edit-tags" value="${escapeHtml(memo.tags.join(', '))}" placeholder="태그 (쉼표로 구분)">
      <div class="card-actions">
        <button type="submit" class="btn btn-save">저장</button>
        <button type="button" class="btn btn-cancel">취소</button>
      </div>
    </form>
  `;
  card.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title    = card.querySelector('.edit-title').value.trim();
    const content  = card.querySelector('.edit-content').value.trim();
    const category = card.querySelector('.edit-category').value;
    const tags     = parseTags(card.querySelector('.edit-tags').value);
    await updateMemo(memo.id, title, content, category, tags);
    await reload();
  });
  card.querySelector('.btn-cancel').addEventListener('click', () => reload());
  card.querySelector('.edit-title').focus();
}

// ── 유틸 ──────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseTags(raw) {
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

function slugify(str) {
  const map = { '업무': 'work', '개인': 'personal', '아이디어': 'idea', '기타': 'etc' };
  return map[str] || 'etc';
}

async function reload() {
  allMemos = await fetchMemos();
  renderMemos(applyFilters(allMemos));
  renderActiveTags();
}

// ── 이벤트 바인딩 ─────────────────────────────────────────

// 인증 탭 전환
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('register-form').classList.toggle('hidden', isLogin);
  });
});

// 로그인
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const data = await apiLogin(username, password);
    saveTokens(data.access_token, data.refresh_token);
    showMemo(username);
    await reload();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

// 회원가입
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('register-error');
  errEl.textContent = '';
  try {
    await apiRegister(username, email, password);
    const data = await apiLogin(username, password);
    saveTokens(data.access_token, data.refresh_token);
    showMemo(username);
    await reload();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

// 로그아웃
document.getElementById('logout-btn').addEventListener('click', async () => {
  await apiLogout();
  allMemos = [];
  activeCategory = '';
  activeTags.clear();
  showAuth();
});

// 카테고리 탭 필터
document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeCategory = tab.dataset.category;
    renderMemos(applyFilters(allMemos));
  });
});

// 메모 추가
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titleEl    = document.getElementById('add-title');
  const contentEl  = document.getElementById('add-content');
  const categoryEl = document.getElementById('add-category');
  const tagsEl     = document.getElementById('add-tags');

  const title    = titleEl.value.trim();
  const content  = contentEl.value.trim();
  const category = categoryEl.value;
  const tags     = parseTags(tagsEl.value);

  if (!title || !content) return;
  await createMemo(title, content, category, tags);

  titleEl.value    = '';
  contentEl.value  = '';
  categoryEl.value = '';
  tagsEl.value     = '';
  titleEl.focus();
  await reload();
});

// ── 초기화 ────────────────────────────────────────────────

async function init() {
  if (!getAccessToken()) { showAuth(); return; }
  const res = await authFetch('/auth/me');
  if (!res) return;
  const user = await res.json();
  showMemo(user.username);
  await reload();
}

init();
