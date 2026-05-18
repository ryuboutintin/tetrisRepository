const API = '/api/memos';
let editingId = null;

async function fetchMemos() {
  const res = await fetch(API);
  const memos = await res.json();
  renderMemos(memos);
}

function renderMemos(memos) {
  const list = document.getElementById('memoList');
  if (memos.length === 0) {
    list.innerHTML = '<p class="empty">메모가 없습니다. 새 메모를 작성해 보세요.</p>';
    return;
  }
  list.innerHTML = memos.map(m => `
    <div class="memo-card" id="card-${m.id}">
      <div class="memo-header">
        <div class="memo-title">${escapeHtml(m.title)}</div>
        <div class="memo-actions">
          <button class="secondary" onclick="startEdit(${m.id})">수정</button>
          <button class="danger" onclick="deleteMemo(${m.id})">삭제</button>
        </div>
      </div>
      <div class="memo-content">${escapeHtml(m.content)}</div>
      <div class="memo-date">${formatDate(m.updated_at)}</div>
    </div>
  `).join('');
}

async function saveMemo() {
  const title = document.getElementById('titleInput').value.trim();
  const content = document.getElementById('contentInput').value.trim();
  if (!title || !content) {
    alert('제목과 내용을 모두 입력해 주세요.');
    return;
  }

  if (editingId !== null) {
    await fetch(`${API}/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    cancelEdit();
  } else {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    document.getElementById('titleInput').value = '';
    document.getElementById('contentInput').value = '';
  }
  fetchMemos();
}

async function startEdit(id) {
  const res = await fetch(`${API}/${id}`);
  const memo = await res.json();
  document.getElementById('titleInput').value = memo.title;
  document.getElementById('contentInput').value = memo.content;
  document.getElementById('saveBtn').textContent = '수정 완료';
  document.getElementById('cancelBtn').style.display = 'inline-block';
  editingId = id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingId = null;
  document.getElementById('titleInput').value = '';
  document.getElementById('contentInput').value = '';
  document.getElementById('saveBtn').textContent = '저장';
  document.getElementById('cancelBtn').style.display = 'none';
}

async function deleteMemo(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  fetchMemos();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

fetchMemos();
