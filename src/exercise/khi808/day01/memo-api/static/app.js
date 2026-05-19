'use strict';

const TOKEN_KEY = 'memo_token';
const USER_KEY  = 'memo_username';

/* ── State ── */
let memos            = [];
let categories       = [];
let tags             = [];
let currentTags      = [];   // 편집 중인 메모의 태그 목록
let activeId         = null;
let activeCategoryId = null;
let activeTag        = null;

/* ── DOM — Auth ── */
const authWrap        = document.getElementById('authWrap');
const loginForm       = document.getElementById('loginForm');
const registerForm    = document.getElementById('registerForm');
const loginError      = document.getElementById('loginError');
const registerError   = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');

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
const inputCategory= document.getElementById('inputCategory');
const inputTagText = document.getElementById('inputTagText');
const formTagChips = document.getElementById('formTagChips');
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
const getToken  = () => localStorage.getItem(TOKEN_KEY);
const setToken  = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearAuth = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

/* ── API helpers ── */
async function request(method, path, body = null, auth = true) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) headers['Authorization'] = `Bearer ${getToken()}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || '오류가 발생했습니다.');
  return data;
}

const authReq = (m, p, b) => request(m, p, b, false);
const api     = (m, p, b) => request(m, p, b, true);

/* ── Toast ── */
let toastTimer;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 2500);
}

/* ── Auth tab ── */
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

function showAuth() {
  authWrap.classList.remove('hidden');
  app.classList.add('hidden');
}

async function showApp(username) {
  authWrap.classList.add('hidden');
  app.classList.remove('hidden');
  usernameBadge.textContent = `👤 ${username}`;
  await loadCategories();
  await loadTags();
  await loadMemos();
}

/* ── Login ── */
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  try {
    const data = await authReq('POST', '/auth/login', { username, password });
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
    await authReq('POST', '/auth/register', { username, password });
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
  memos = []; categories = []; tags = []; currentTags = [];
  activeId = null; activeCategoryId = null; activeTag = null;
  memoForm.classList.add('hidden');
  emptyEditor.classList.remove('hidden');
  showAuth();
});

/* ── Categories ── */
async function loadCategories() {
  categories = await api('GET', '/categories');
  renderCategoryDropdown();
  renderCategorySelect();
}

function renderCategoryDropdown() {
  const sel = document.getElementById('categoryFilter');
  const prev = sel.value;
  sel.innerHTML = '<option value="">전체</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  sel.value = (activeCategoryId !== null) ? activeCategoryId : '';
}

function renderCategorySelect() {
  const prev = inputCategory.value;
  inputCategory.innerHTML = '<option value="">없음</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    inputCategory.appendChild(opt);
  });
  inputCategory.value = prev;
}

function onCategoryFilterChange(val) {
  activeCategoryId = val ? parseInt(val) : null;
  activeTag = null;
  renderTagFilter();
  loadMemos();
}

/* ── Category modal ── */
function openCategoryModal() {
  const modal = document.getElementById('categoryModal');
  const inp   = document.getElementById('categoryNameInput');
  inp.value = '';
  modal.classList.remove('hidden');
  inp.focus();
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.add('hidden');
}

async function submitCategory() {
  const inp  = document.getElementById('categoryNameInput');
  const name = inp.value.trim();
  if (!name) return;
  try {
    await api('POST', '/categories', { name });
    closeCategoryModal();
    await loadCategories();
    showToast('카테고리가 추가됐습니다.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('카테고리를 삭제할까요? (해당 메모의 카테고리는 해제됩니다)')) return;
  try {
    await api('DELETE', `/categories/${id}`);
    if (activeCategoryId === id) {
      activeCategoryId = null;
      document.getElementById('categoryFilter').value = '';
    }
    await loadCategories();
    await loadMemos();
    showToast('카테고리가 삭제됐습니다.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Tags (filter) ── */
async function loadTags() {
  tags = await api('GET', '/tags');
  renderTagFilter();
}

function renderTagFilter() {
  const wrap = document.getElementById('tagFilterChips');
  wrap.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'tag-filter-chip' + (activeTag === null ? ' active' : '');
  allBtn.textContent = '전체';
  allBtn.onclick = () => selectTagFilter(null);
  wrap.appendChild(allBtn);

  tags.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-filter-chip' + (activeTag === t.name ? ' active' : '');
    btn.textContent = t.name;
    btn.onclick = () => selectTagFilter(t.name);
    wrap.appendChild(btn);
  });
}

function selectTagFilter(tagName) {
  activeTag = tagName;
  activeCategoryId = null;
  document.getElementById('categoryFilter').value = '';
  renderTagFilter();
  loadMemos();
}

/* ── Tags (form input) ── */
function renderFormTags() {
  formTagChips.innerHTML = '';
  currentTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'form-tag-chip';
    chip.innerHTML = `${esc(tag)}<button type="button" class="tag-chip-del" onclick="removeFormTag('${esc(tag)}')">×</button>`;
    formTagChips.appendChild(chip);
  });
}

function addFormTag(raw) {
  const name = raw.trim().replace(/,+$/, '').trim();
  if (!name || currentTags.includes(name)) return;
  currentTags.push(name);
  renderFormTags();
}

function removeFormTag(name) {
  currentTags = currentTags.filter(t => t !== name);
  renderFormTags();
}

inputTagText.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addFormTag(inputTagText.value);
    inputTagText.value = '';
  }
});

inputTagText.addEventListener('blur', () => {
  if (inputTagText.value.trim()) {
    addFormTag(inputTagText.value);
    inputTagText.value = '';
  }
});

/* ── Load memos ── */
async function loadMemos() {
  try {
    const params = [];
    if (activeCategoryId !== null) params.push(`category_id=${activeCategoryId}`);
    if (activeTag !== null)        params.push(`tag=${encodeURIComponent(activeTag)}`);
    const qs = params.length ? '?' + params.join('&') : '';
    memos = await api('GET', `/memos${qs}`);
    renderList();
  } catch (err) {
    if (err.message.includes('토큰')) { clearAuth(); showAuth(); }
    else showToast(err.message, 'error');
  }
}

/* ── Render list ── */
function renderList() {
  const kw = searchInput.value.toLowerCase();
  const filtered = kw
    ? memos.filter(m => m.title.toLowerCase().includes(kw) || m.content.toLowerCase().includes(kw))
    : memos;

  memoList.innerHTML = '';
  emptyList.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(m => {
    const cat = m.category_id ? categories.find(c => c.id === m.category_id) : null;
    const li  = document.createElement('li');
    li.className = 'memo-item' + (m.id === activeId ? ' active' : '');

    const tagsHtml = (m.tags || []).map(t => `<span class="item-tag">${esc(t)}</span>`).join('');

    li.innerHTML = `
      <span class="item-title">${esc(m.title)}</span>
      <span class="item-preview">${esc(m.content.slice(0, 60))}</span>
      <div class="item-meta">
        ${cat ? `<span class="item-category">${esc(cat.name)}</span>` : ''}
        ${tagsHtml}
        <span class="item-date">${fmtDate(m.updated_at)}</span>
      </div>
    `;
    li.addEventListener('click', () => openMemo(m.id));
    memoList.appendChild(li);
  });
}

/* ── Open memo ── */
function openMemo(id) {
  const memo = memos.find(m => m.id === id);
  if (!memo) return;
  activeId = id;
  inputTitle.value    = memo.title;
  inputContent.value  = memo.content;
  inputCategory.value = memo.category_id ?? '';
  currentTags = [...(memo.tags || [])];
  renderFormTags();
  inputTagText.value    = '';
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
  inputCategory.value   = activeCategoryId ?? '';
  currentTags           = [];
  renderFormTags();
  inputTagText.value    = '';
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

/* ── Create / Update ── */
memoForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title   = inputTitle.value.trim();
  const content = inputContent.value.trim();
  if (!title || !content) { showToast('제목과 내용을 모두 입력하세요.', 'error'); return; }

  // 입력 중인 태그가 있으면 자동 추가
  if (inputTagText.value.trim()) {
    addFormTag(inputTagText.value);
    inputTagText.value = '';
  }

  const payload = {
    title,
    content,
    category_id: inputCategory.value ? parseInt(inputCategory.value) : null,
    tags: currentTags,
  };

  try {
    if (activeId === null) {
      const created = await api('POST', '/memos', payload);
      memos.unshift(created);
      activeId = created.id;
      formBadge.textContent = '메모 수정';
      btnSave.textContent   = '수정';
      btnDelete.classList.remove('hidden');
      showToast('메모가 생성됐습니다.');
    } else {
      const updated = await api('PUT', `/memos/${activeId}`, payload);
      const idx = memos.findIndex(m => m.id === activeId);
      if (idx !== -1) memos[idx] = updated;
      showToast('메모가 수정됐습니다.');
    }
    await loadTags();
    renderList();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

/* ── Delete ── */
btnDelete.addEventListener('click', async () => {
  if (!confirm('이 메모를 삭제할까요?')) return;
  try {
    await api('DELETE', `/memos/${activeId}`);
    memos = memos.filter(m => m.id !== activeId);
    activeId = null;
    currentTags = [];
    memoForm.classList.add('hidden');
    emptyEditor.classList.remove('hidden');
    await loadTags();
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

/* ── Category modal bindings ── */
document.getElementById('btnCategoryConfirm').addEventListener('click', submitCategory);
document.getElementById('btnCategoryCancel').addEventListener('click', closeCategoryModal);
document.getElementById('categoryModal').addEventListener('click', e => {
  if (e.target === document.getElementById('categoryModal')) closeCategoryModal();
});
document.getElementById('categoryNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter')  { e.preventDefault(); submitCategory(); }
  if (e.key === 'Escape') closeCategoryModal();
});

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
