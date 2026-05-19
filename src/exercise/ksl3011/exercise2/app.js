const API = 'http://localhost:8000';
const TOKEN_KEY = 'memo-token';

// ── 상태 ────────────────────────────────────────────────────────────────────
let allMemos    = [];
let trashMemos  = [];
let currentId   = null;
let isNew       = false;
let isTrashView = false;
let activeTag   = null;
let autoSaveTimer = null;

// ── DOM ─────────────────────────────────────────────────────────────────────
const memoList     = document.getElementById('memoList');
const emptyMsg     = document.getElementById('emptyMsg');
const editForm     = document.getElementById('editForm');
const placeholder  = document.getElementById('placeholder');
const titleInput   = document.getElementById('titleInput');
const contentInput = document.getElementById('contentInput');
const tagsInput    = document.getElementById('tagsInput');
const saveBtn      = document.getElementById('saveBtn');
const deleteBtn    = document.getElementById('deleteBtn');
const themeToggle  = document.getElementById('themeToggle');
const toast        = document.getElementById('toast');
const searchInput  = document.getElementById('searchInput');
const tagFilter    = document.getElementById('tagFilter');
const trashBtn     = document.getElementById('trashBtn');
const exportBtn    = document.getElementById('exportBtn');
const importFile   = document.getElementById('importFile');
const saveStatus   = document.getElementById('saveStatus');
const delConfirm   = document.getElementById('delConfirm');
const delCancel    = document.getElementById('delCancel');
const delConfirmBtn= document.getElementById('delConfirmBtn');
const sidebarTitle = document.getElementById('sidebarTitle');
const newMemoBtn   = document.getElementById('newMemoBtn');
const authOverlay  = document.getElementById('authOverlay');
const authForm     = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authSubmit   = document.getElementById('authSubmit');
const authError    = document.getElementById('authError');
const tabLogin     = document.getElementById('tabLogin');
const tabRegister  = document.getElementById('tabRegister');
const logoutBtn    = document.getElementById('logoutBtn');
const userLabel    = document.getElementById('userLabel');

// ── 토큰 유틸 ────────────────────────────────────────────────────────────────
function getToken()    { return localStorage.getItem(TOKEN_KEY); }
function setToken(t)   { localStorage.setItem(TOKEN_KEY, t); }
function clearToken()  { localStorage.removeItem(TOKEN_KEY); }

function getUsername() {
  try {
    const payload = JSON.parse(atob(getToken().split('.')[1]));
    return payload.sub || null;
  } catch { return null; }
}

// ── 인증 화면 ────────────────────────────────────────────────────────────────
let authMode = 'login';

function showAuthOverlay() {
  authOverlay.classList.remove('hidden');
  authUsername.value = '';
  authPassword.value = '';
  authError.classList.add('hidden');
  authUsername.focus();
}

function hideAuthOverlay() {
  authOverlay.classList.add('hidden');
}

tabLogin.addEventListener('click', () => {
  authMode = 'login';
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  authSubmit.textContent = '로그인';
  authError.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
  authMode = 'register';
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  authSubmit.textContent = '회원가입';
  authError.classList.add('hidden');
});

authForm.addEventListener('submit', async e => {
  e.preventDefault();
  const username = authUsername.value.trim();
  const password = authPassword.value;
  const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';

  try {
    const res = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      let msg;
      if (Array.isArray(data.detail)) {
        msg = data.detail.map(e => (typeof e === 'string' ? e : e.msg || '유효성 검사 오류')).join(', ');
      } else if (typeof data.detail === 'string') {
        msg = data.detail;
      } else {
        msg = '오류가 발생했습니다.';
      }
      throw new Error(msg);
    }
    setToken(data.access_token);
    userLabel.textContent = username;
    if (authMode === 'register') {
      alert(`${username}님, 회원가입이 완료되었습니다! 환영합니다.`);
    }
    hideAuthOverlay();
    loadMemos();
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  allMemos = [];
  trashMemos = [];
  currentId = null;
  closeEditor();
  renderList();
  renderTagFilter();
  showAuthOverlay();
});

// ── 테마 ────────────────────────────────────────────────────────────────────
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

// ── 토스트 ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── API 헬퍼 ────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { headers, ...options });
  if (res.status === 401) {
    clearToken();
    showAuthOverlay();
    throw new Error('인증이 필요합니다.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── 저장 상태 표시 ───────────────────────────────────────────────────────────
let savedFadeTimer;
function setSaveStatus(state) {
  clearTimeout(savedFadeTimer);
  if (state === 'saving') {
    saveStatus.textContent = '저장 중…';
    saveStatus.className = 'save-status saving';
  } else if (state === 'saved') {
    saveStatus.textContent = '저장됨';
    saveStatus.className = 'save-status saved';
    savedFadeTimer = setTimeout(() => {
      saveStatus.textContent = '';
      saveStatus.className = 'save-status';
    }, 2000);
  } else {
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';
  }
}

// ── 자동 저장 ────────────────────────────────────────────────────────────────
function scheduleAutoSave() {
  if (!currentId && !isNew) return;
  setSaveStatus('saving');
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => doSave(true), 1500);
}

[titleInput, contentInput, tagsInput].forEach(el =>
  el.addEventListener('input', scheduleAutoSave)
);

// ── 태그 필터 렌더링 ─────────────────────────────────────────────────────────
function renderTagFilter() {
  const tags = [...new Set(allMemos.flatMap(m => m.tags || []))].sort();
  tagFilter.innerHTML = '';
  if (!tags.length) {
    tagFilter.classList.add('hidden');
    return;
  }
  tagFilter.classList.remove('hidden');
  tags.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'tag-chip' + (t === activeTag ? ' active' : '');
    btn.textContent = t;
    btn.addEventListener('click', () => {
      activeTag = activeTag === t ? null : t;
      renderTagFilter();
      renderList();
    });
    tagFilter.appendChild(btn);
  });
}

// ── 목록 필터링 ──────────────────────────────────────────────────────────────
function getFilteredMemos() {
  const q = searchInput.value.trim().toLowerCase();
  return allMemos.filter(m => {
    if (activeTag && !(m.tags || []).includes(activeTag)) return false;
    if (q) {
      const inTitle   = (m.title   || '').toLowerCase().includes(q);
      const inContent = (m.content || '').toLowerCase().includes(q);
      if (!inTitle && !inContent) return false;
    }
    return true;
  });
}

// ── 목록 렌더링 ──────────────────────────────────────────────────────────────
function renderList() {
  memoList.innerHTML = '';

  if (isTrashView) {
    emptyMsg.classList.toggle('hidden', trashMemos.length > 0);
    if (!trashMemos.length) {
      emptyMsg.textContent = '휴지통이 비어 있어요';
      return;
    }
    trashMemos.forEach(m => {
      const li  = document.createElement('li');
      li.className = 'memo-item memo-item--trash';
      const date = new Date(m.deleted_at || m.updated_at)
        .toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      const title = m.title || m.content.split('\n')[0].slice(0, 32) || '빈 메모';
      li.innerHTML = `
        <div class="item-header">
          <span class="item-title">${title}</span>
          <span class="item-date">${date}</span>
        </div>
        <div class="item-preview">${m.content}</div>
        <div class="trash-actions">
          <button class="trash-btn" data-action="restore" data-id="${m.id}">복구</button>
          <button class="trash-btn trash-btn--danger" data-action="perm" data-id="${m.id}">영구 삭제</button>
        </div>
      `;
      memoList.appendChild(li);
    });
    return;
  }

  // 일반 뷰
  emptyMsg.textContent = '아직 메모가 없어요';
  const filtered = getFilteredMemos();
  emptyMsg.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(m => {
    const li  = document.createElement('li');
    li.className = 'memo-item' + (m.id === currentId ? ' active' : '');
    li.dataset.id = m.id;
    const date = new Date(m.updated_at)
      .toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    const firstLine = m.content.split('\n')[0].trim();
    const title   = m.title || firstLine.slice(0, 32) || '빈 메모';
    const preview = m.title
      ? firstLine
      : (m.content.split('\n').slice(1).join(' ').trim() || firstLine);

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

// ── 에디터 열기 / 닫기 ───────────────────────────────────────────────────────
function openEditor(memo) {
  placeholder.classList.add('hidden');
  editForm.classList.remove('hidden');
  titleInput.value   = memo.title   || '';
  contentInput.value = memo.content || '';
  tagsInput.value    = (memo.tags   || []).join(', ');
  deleteBtn.style.display = isNew ? 'none' : '';
  hideDelConfirm();
  setSaveStatus('idle');
  if (isNew) titleInput.focus(); else contentInput.focus();
}

function closeEditor() {
  placeholder.classList.remove('hidden');
  editForm.classList.add('hidden');
  currentId = null;
  isNew     = false;
  clearTimeout(autoSaveTimer);
  setSaveStatus('idle');
  hideDelConfirm();
  renderList();
}

// ── 메모 선택 ────────────────────────────────────────────────────────────────
function selectMemo(id) {
  const memo = allMemos.find(m => m.id === id);
  if (!memo) return;
  clearTimeout(autoSaveTimer);
  currentId = id;
  isNew     = false;
  renderList();
  openEditor(memo);
}

// ── 저장 (수동 + 자동) ───────────────────────────────────────────────────────
async function doSave(isAuto = false) {
  const tags    = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  const payload = {
    content: contentInput.value.trim(),
    title:   titleInput.value.trim() || null,
    tags,
  };
  if (!payload.content) {
    if (!isAuto) showToast('내용을 입력해주세요.');
    setSaveStatus('idle');
    return;
  }

  try {
    if (isNew) {
      const created = await apiFetch('/memos', { method: 'POST', body: JSON.stringify(payload) });
      allMemos.unshift(created);
      currentId = created.id;
      isNew     = false;
      deleteBtn.style.display = '';
    } else {
      const updated = await apiFetch(`/memos/${currentId}`, { method: 'PUT', body: JSON.stringify(payload) });
      allMemos = allMemos.map(m => m.id === currentId ? updated : m);
    }
    setSaveStatus('saved');
    renderTagFilter();
    renderList();
    if (!isAuto) showToast('저장되었습니다.');
  } catch (e) {
    setSaveStatus('idle');
    showToast('오류: ' + e.message);
  }
}

editForm.addEventListener('submit', e => { e.preventDefault(); doSave(false); });

// ── 삭제 (인라인 확인) ───────────────────────────────────────────────────────
function showDelConfirm() {
  deleteBtn.style.display = 'none';
  delConfirm.classList.remove('hidden');
}
function hideDelConfirm() {
  delConfirm.classList.add('hidden');
  deleteBtn.style.display = currentId ? '' : 'none';
}

deleteBtn.addEventListener('click', showDelConfirm);
delCancel.addEventListener('click',  hideDelConfirm);

delConfirmBtn.addEventListener('click', async () => {
  if (!currentId) return;
  try {
    await apiFetch(`/memos/${currentId}`, { method: 'DELETE' });
    allMemos = allMemos.filter(m => m.id !== currentId);
    showToast('휴지통으로 이동했습니다.');
    closeEditor();
    renderTagFilter();
    if (isTrashView) await loadTrash();
  } catch (e) {
    showToast('오류: ' + e.message);
  }
});

// ── 새 메모 ──────────────────────────────────────────────────────────────────
newMemoBtn.addEventListener('click', () => {
  if (isTrashView) return;
  clearTimeout(autoSaveTimer);
  currentId = null;
  isNew     = true;
  renderList();
  openEditor({ title: '', content: '', tags: [] });
});

// ── 검색 ─────────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  currentId = null;
  renderList();
});

// ── 휴지통 토글 ──────────────────────────────────────────────────────────────
trashBtn.addEventListener('click', async () => {
  isTrashView = !isTrashView;
  trashBtn.classList.toggle('active', isTrashView);
  sidebarTitle.textContent = isTrashView ? '휴지통' : '메모장';
  newMemoBtn.style.visibility = isTrashView ? 'hidden' : '';
  searchInput.disabled = isTrashView;

  if (isTrashView) {
    closeEditor();
    await loadTrash();
  } else {
    emptyMsg.textContent = '아직 메모가 없어요';
    renderTagFilter();
    renderList();
  }
});

// 휴지통 내 버튼 위임
memoList.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id     = parseInt(btn.dataset.id);
  const action = btn.dataset.action;

  if (action === 'restore') {
    try {
      const restored = await apiFetch(`/memos/${id}/restore`, { method: 'POST' });
      allMemos.unshift(restored);
      trashMemos = trashMemos.filter(m => m.id !== id);
      showToast('복구되었습니다.');
      renderList();
      renderTagFilter();
    } catch (e) { showToast('오류: ' + e.message); }
  }

  if (action === 'perm') {
    if (!confirm('영구 삭제하면 복구할 수 없습니다. 계속할까요?')) return;
    try {
      await apiFetch(`/memos/${id}/permanent`, { method: 'DELETE' });
      trashMemos = trashMemos.filter(m => m.id !== id);
      showToast('영구 삭제되었습니다.');
      renderList();
    } catch (e) { showToast('오류: ' + e.message); }
  }
});

// ── 내보내기 ─────────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', () => {
  if (!allMemos.length) { showToast('내보낼 메모가 없습니다.'); return; }
  const blob = new Blob(
    [JSON.stringify(allMemos, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), {
    href: url,
    download: `memos_${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${allMemos.length}개 메모를 내보냈습니다.`);
});

// ── 가져오기 ─────────────────────────────────────────────────────────────────
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  try {
    const token = getToken();
    const res  = await fetch(`${API}/memos/import`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'import 실패');
    showToast(`${data.imported}개 메모를 가져왔습니다.`);
    await loadMemos();
  } catch (e) {
    showToast('가져오기 오류: ' + e.message);
  } finally {
    importFile.value = '';
  }
});

// ── 키보드 단축키 ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!delConfirm.classList.contains('hidden')) {
      hideDelConfirm();
    } else if (isNew && !contentInput.value.trim()) {
      closeEditor();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    clearTimeout(autoSaveTimer);
    doSave(false);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    if (!isTrashView) newMemoBtn.click();
  }
});

// ── 초기 로드 ─────────────────────────────────────────────────────────────────
async function loadMemos() {
  try {
    allMemos = await apiFetch('/memos');
    renderTagFilter();
    renderList();
  } catch (e) {
    showToast('서버 연결 실패: ' + e.message);
  }
}

async function loadTrash() {
  try {
    trashMemos = await apiFetch('/memos/trash');
    renderList();
  } catch (e) {
    showToast('오류: ' + e.message);
  }
}

if (getToken()) {
  userLabel.textContent = getUsername() || '사용자';
  loadMemos();
} else {
  showAuthOverlay();
}
