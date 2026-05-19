// ── 인증 ────────────────────────────────────────────────────────────
let currentTab = 'login';

function getToken()          { return localStorage.getItem('memo_token'); }
function setToken(t)         { localStorage.setItem('memo_token', t); }
function clearToken()        { localStorage.removeItem('memo_token'); }
function getRefreshToken()   { return localStorage.getItem('memo_refresh_token'); }
function setRefreshToken(t)  { localStorage.setItem('memo_refresh_token', t); }
function clearRefreshToken() { localStorage.removeItem('memo_refresh_token'); }

function authHeaders() {
  return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

async function refreshAccessToken() {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return true;
  } catch { return false; }
}

async function apiFetch(url, options = {}) {
  const makeReq = () => fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  let res = await makeReq();
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      res = await makeReq();
      if (res.status === 401) { logout(); return null; }
    } else {
      logout();
      return null;
    }
  }
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
    const res = await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
    const data = await res.json();
    setToken(data.access_token);
    setRefreshToken(data.refresh_token);
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
  const rt = getRefreshToken();
  if (rt) {
    fetch('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    }).catch(() => {});
  }
  clearToken();
  clearRefreshToken();
  memos = [];
  currentTag = null;
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('notes-board').innerHTML = '';
  document.getElementById('tag-filter-bar').className = 'tag-filter-bar';
  document.getElementById('header-username').textContent = '';
  switchTab('login');
}

// ── 초기화 ───────────────────────────────────────────────────────────
(async function init() {
  const token = getToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) { showApp(payload.sub); return; }
    } catch {}
  }
  const ok = await refreshAccessToken();
  if (ok) {
    try {
      const payload = JSON.parse(atob(getToken().split('.')[1]));
      showApp(payload.sub);
    } catch { clearToken(); clearRefreshToken(); }
  }
})();

// ── 메모 데이터 ──────────────────────────────────────────────────────
let memos = [];
let currentTag = null;

const NOTE_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'teal'];

async function fetchMemos() {
  const res = await apiFetch('/memos');
  if (!res) return;
  memos = await res.json();
  renderNotes();
}

// ── 렌더링 ───────────────────────────────────────────────────────────
function renderNotes() {
  updateTagFilterBar();
  renderFilteredNotes();
}

function renderFilteredNotes() {
  const board = document.getElementById('notes-board');
  const filtered = currentTag ? memos.filter(m => m.tags.includes(currentTag)) : memos;

  if (filtered.length === 0 && memos.length === 0) {
    board.innerHTML = `
      <div class="empty-board">
        <div class="empty-icon">📌</div>
        <p>새 메모 버튼을 눌러 첫 메모를 추가하세요.</p>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    board.innerHTML = `
      <div class="empty-board">
        <div class="empty-icon">🔍</div>
        <p>#${escHtml(currentTag)} 태그가 달린 메모가 없습니다.</p>
      </div>`;
    return;
  }

  board.innerHTML = filtered.map(createNoteCard).join('');
  board.querySelectorAll('.note-body').forEach(autoResize);
}

function createNoteCard(memo) {
  const color = memo.color || 'yellow';
  const dots = NOTE_COLORS.map(c => `
    <button class="color-dot ${c === color ? 'active' : ''}"
            data-color="${c}"
            onclick="setColor(${memo.id}, '${c}')"
            title="${c}"></button>
  `).join('');

  return `
    <div class="note" data-id="${memo.id}" data-color="${color}">
      <div class="note-header">
        <div class="note-colors">${dots}</div>
        <button class="note-close" onclick="deleteMemoCard(${memo.id})" title="삭제">✕</button>
      </div>
      <input  class="note-title"
              id="note-title-${memo.id}"
              placeholder="제목 없음"
              value="${escAttr(memo.title)}"
              oninput="scheduleSave(${memo.id})" />
      <textarea class="note-body"
                id="note-body-${memo.id}"
                placeholder="내용을 입력하세요..."
                oninput="scheduleSave(${memo.id}); autoResize(this)">${escHtml(memo.content)}</textarea>
      <div class="note-tags" id="note-tags-${memo.id}">
        ${renderTagChips(memo.id, memo.tags)}
        <button class="tag-add-btn" onclick="startTagInput(${memo.id})">+ 태그</button>
      </div>
      <div class="note-footer">
        <span class="note-date" id="note-date-${memo.id}">${formatDate(memo.updated_at)}</span>
        <span class="note-saving">저장 중...</span>
      </div>
    </div>`;
}

function renderTagChips(id, tags) {
  return (tags || []).map(tag => `
    <span class="tag-chip">
      #${escHtml(tag)}<button class="tag-chip-remove"
        onclick="removeTag(${id}, '${escAttr(tag)}')" title="삭제">✕</button>
    </span>
  `).join('');
}

// ── 태그 필터 바 ─────────────────────────────────────────────────────
function updateTagFilterBar() {
  const allTags = [...new Set(memos.flatMap(m => m.tags || []))].sort();
  const bar = document.getElementById('tag-filter-bar');

  if (allTags.length === 0) {
    bar.className = 'tag-filter-bar';
    return;
  }

  bar.className = 'tag-filter-bar visible';
  bar.innerHTML = `
    <button class="tag-filter-btn ${currentTag === null ? 'active' : ''}" onclick="filterByTag(null)">전체</button>
    ${allTags.map(tag => `
      <button class="tag-filter-btn ${currentTag === tag ? 'active' : ''}"
              onclick="filterByTag('${escAttr(tag)}')">#${escHtml(tag)}</button>
    `).join('')}
  `;
}

function filterByTag(tag) {
  currentTag = tag;
  updateTagFilterBar();
  renderFilteredNotes();
}

// ── 태그 추가 / 삭제 ─────────────────────────────────────────────────
function startTagInput(id) {
  const tagsEl = document.getElementById(`note-tags-${id}`);
  if (!tagsEl) return;

  const existing = tagsEl.querySelector('.tag-input');
  if (existing) { existing.focus(); return; }

  const addBtn = tagsEl.querySelector('.tag-add-btn');

  const input = document.createElement('input');
  input.className = 'tag-input';
  input.placeholder = '태그 입력...';
  input.maxLength = 20;

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const name = input.value.trim().replace(/^#/, '');
      if (name) { await addTag(id, name); input.value = ''; }
    } else if (e.key === 'Escape') {
      finishTagInput(id);
    }
  });

  input.addEventListener('blur', async () => {
    const name = input.value.trim().replace(/^#/, '');
    if (name) await addTag(id, name);
    else finishTagInput(id);
  });

  tagsEl.insertBefore(input, addBtn);
  input.focus();
}

function finishTagInput(id) {
  const tagsEl = document.getElementById(`note-tags-${id}`);
  if (!tagsEl) return;
  tagsEl.querySelector('.tag-input')?.remove();
}

async function addTag(id, tagName) {
  const memo = memos.find(m => m.id === id);
  if (!memo || memo.tags.includes(tagName)) { finishTagInput(id); return; }

  const newTags = [...memo.tags, tagName];
  const res = await apiFetch(`/memos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ tags: newTags }),
  });
  if (!res) return;

  const updated = await res.json();
  memo.tags = updated.tags;
  _refreshTagChips(id, memo.tags);
  updateTagFilterBar();
}

async function removeTag(id, tagName) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;

  const newTags = memo.tags.filter(t => t !== tagName);
  const res = await apiFetch(`/memos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ tags: newTags }),
  });
  if (!res) return;

  const updated = await res.json();
  memo.tags = updated.tags;
  _refreshTagChips(id, memo.tags);
  updateTagFilterBar();
}

function _refreshTagChips(id, tags) {
  const tagsEl = document.getElementById(`note-tags-${id}`);
  if (!tagsEl) return;
  tagsEl.querySelectorAll('.tag-chip').forEach(el => el.remove());
  const addBtn = tagsEl.querySelector('.tag-add-btn');
  addBtn.insertAdjacentHTML('beforebegin', renderTagChips(id, tags));
}

// ── 새 메모 ──────────────────────────────────────────────────────────
async function newMemo() {
  const res = await apiFetch('/memos', {
    method: 'POST',
    body: JSON.stringify({ title: '', content: '', color: 'yellow', tags: [] }),
  });
  if (!res) return;
  const memo = await res.json();
  memos.unshift(memo);
  currentTag = null;

  updateTagFilterBar();

  const board = document.getElementById('notes-board');
  board.querySelector('.empty-board')?.remove();
  board.insertAdjacentHTML('afterbegin', createNoteCard(memo));
  autoResize(document.getElementById(`note-body-${memo.id}`));
  document.getElementById(`note-title-${memo.id}`)?.focus();
}

// ── 색상 변경 ────────────────────────────────────────────────────────
async function setColor(id, color) {
  const noteEl = document.querySelector(`.note[data-id="${id}"]`);
  if (!noteEl) return;

  const prevColor = noteEl.getAttribute('data-color');
  noteEl.setAttribute('data-color', color);
  noteEl.querySelectorAll('.color-dot').forEach(dot =>
    dot.classList.toggle('active', dot.getAttribute('data-color') === color)
  );

  const res = await apiFetch(`/memos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ color }),
  });
  if (!res) {
    noteEl.setAttribute('data-color', prevColor);
    noteEl.querySelectorAll('.color-dot').forEach(dot =>
      dot.classList.toggle('active', dot.getAttribute('data-color') === prevColor)
    );
    return;
  }
  const memo = memos.find(m => m.id === id);
  if (memo) memo.color = color;
}

// ── 자동 저장 ─────────────────────────────────────────────────────────
const saveTimers = {};

function scheduleSave(id) {
  clearTimeout(saveTimers[id]);
  document.querySelector(`.note[data-id="${id}"]`)?.setAttribute('data-saving', '');
  saveTimers[id] = setTimeout(() => saveNote(id), 700);
}

async function saveNote(id) {
  const titleEl = document.getElementById(`note-title-${id}`);
  const bodyEl  = document.getElementById(`note-body-${id}`);
  if (!titleEl || !bodyEl) return;

  const res = await apiFetch(`/memos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: titleEl.value, content: bodyEl.value }),
  });
  if (!res) return;

  const updated = await res.json();
  const memo = memos.find(m => m.id === id);
  if (memo) Object.assign(memo, updated);

  const dateEl = document.getElementById(`note-date-${id}`);
  if (dateEl) dateEl.textContent = formatDate(updated.updated_at);
  document.querySelector(`.note[data-id="${id}"]`)?.removeAttribute('data-saving');
}

// ── 삭제 ─────────────────────────────────────────────────────────────
async function deleteMemoCard(id) {
  if (!confirm('이 메모를 삭제하시겠습니까?')) return;

  const res = await apiFetch(`/memos/${id}`, { method: 'DELETE' });
  if (res === null) return;

  const noteEl = document.querySelector(`.note[data-id="${id}"]`);
  if (noteEl) {
    noteEl.style.cssText += ';opacity:0;transform:scale(0.88) translateY(-4px);transition:all 0.18s ease';
    setTimeout(() => noteEl.remove(), 180);
  }
  memos = memos.filter(m => m.id !== id);

  setTimeout(() => {
    updateTagFilterBar();
    if (memos.length === 0) {
      document.getElementById('notes-board').innerHTML = `
        <div class="empty-board">
          <div class="empty-icon">📌</div>
          <p>새 메모 버튼을 눌러 첫 메모를 추가하세요.</p>
        </div>`;
    } else if (currentTag && !memos.some(m => m.tags.includes(currentTag))) {
      currentTag = null;
      updateTagFilterBar();
      renderFilteredNotes();
    }
  }, 200);
}

// ── 유틸 ─────────────────────────────────────────────────────────────
function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(110, el.scrollHeight) + 'px';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function escHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}
