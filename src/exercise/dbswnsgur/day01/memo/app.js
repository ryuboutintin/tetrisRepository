const API = 'http://localhost:8000';

// DOM 요소
const inputTitle   = document.getElementById('input-title');
const inputContent = document.getElementById('input-content');
const btnSubmit    = document.getElementById('btn-submit');
const btnCancel    = document.getElementById('btn-cancel');
const memoList     = document.getElementById('memo-list');
const emptyMsg     = document.getElementById('empty-msg');
const overlay      = document.getElementById('modal-overlay');
const modalCancel  = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

let editingId = null;   // 현재 편집 중인 메모 id
let deletingId = null;  // 삭제 확인 대기 중인 메모 id

// ── API 호출 ─────────────────────────────────────────

async function fetchMemos() {
  const res = await fetch(`${API}/memos`);
  return res.json();
}

async function createMemo(title, content) {
  const res = await fetch(`${API}/memos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  return res.json();
}

async function updateMemo(id, title, content) {
  const res = await fetch(`${API}/memos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  return res.json();
}

async function deleteMemo(id) {
  await fetch(`${API}/memos/${id}`, { method: 'DELETE' });
}

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

  // 최신순 정렬
  [...memos].reverse().forEach(memo => {
    memoList.appendChild(createCard(memo));
  });
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
  // 다른 카드 편집 중이면 취소
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

// ── 폼 제출 ──────────────────────────────────────────

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

// 내용 입력 시 취소 버튼 표시
[inputTitle, inputContent].forEach(el => {
  el.addEventListener('input', () => {
    const hasValue = inputTitle.value || inputContent.value;
    btnCancel.classList.toggle('hidden', !hasValue);
  });
});

// Enter(제목 필드) → 내용으로 포커스 이동
inputTitle.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); inputContent.focus(); }
});

// Ctrl+Enter → 저장
inputContent.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) btnSubmit.click();
});

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

loadAndRender();
