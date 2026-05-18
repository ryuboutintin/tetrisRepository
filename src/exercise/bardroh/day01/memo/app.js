const API = '/memos';

// ── API 함수 ──────────────────────────────────────────────

async function fetchMemos() {
  const res = await fetch(API);
  return res.json();
}

async function createMemo(title, content) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  return res.json();
}

async function updateMemo(id, title, content) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  return res.json();
}

async function deleteMemo(id) {
  await fetch(`${API}/${id}`, { method: 'DELETE' });
}

// ── 렌더링 ────────────────────────────────────────────────

function renderMemos(memos) {
  const list = document.getElementById('memo-list');
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

function buildCard(memo) {
  const card = document.createElement('div');
  card.className = 'memo-card';
  card.dataset.id = memo.id;

  card.innerHTML = `
    <div class="card-title">${escapeHtml(memo.title)}</div>
    <div class="card-content">${escapeHtml(memo.content)}</div>
    <div class="card-actions">
      <button class="btn btn-edit" data-action="edit">수정</button>
      <button class="btn btn-delete" data-action="delete">삭제</button>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener('click', () => {
    switchToEditMode(card, memo);
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    await deleteMemo(memo.id);
    await reload();
  });

  return card;
}

function switchToEditMode(card, memo) {
  card.classList.add('editing');
  card.innerHTML = `
    <form>
      <input type="text" class="edit-title" value="${escapeHtml(memo.title)}" required>
      <textarea class="edit-content" rows="5" required>${escapeHtml(memo.content)}</textarea>
      <div class="card-actions">
        <button type="submit" class="btn btn-save">저장</button>
        <button type="button" class="btn btn-cancel">취소</button>
      </div>
    </form>
  `;

  card.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = card.querySelector('.edit-title').value.trim();
    const content = card.querySelector('.edit-content').value.trim();
    await updateMemo(memo.id, title, content);
    await reload();
  });

  card.querySelector('.btn-cancel').addEventListener('click', async () => {
    await reload();
  });

  card.querySelector('.edit-title').focus();
}

// ── 유틸 ──────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function reload() {
  const memos = await fetchMemos();
  renderMemos(memos);
}

// ── 초기화 ────────────────────────────────────────────────

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titleEl = document.getElementById('add-title');
  const contentEl = document.getElementById('add-content');
  const title = titleEl.value.trim();
  const content = contentEl.value.trim();
  if (!title || !content) return;

  await createMemo(title, content);
  titleEl.value = '';
  contentEl.value = '';
  titleEl.focus();
  await reload();
});

reload();
