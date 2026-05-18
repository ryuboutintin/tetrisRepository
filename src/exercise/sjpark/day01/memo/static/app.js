const API = '';
let memos = [];
let currentId = null;

async function fetchMemos() {
  const res = await fetch(`${API}/memos`);
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
      <div class="item-date">${formatDate(m.updated_at)}</div>
    </div>
  `).join('');
}

// 메모 클릭 → 뷰 모드
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

// 수정 버튼 → 편집 모드
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

// 새 메모 → 바로 편집 모드
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

// 취소 → 기존 메모면 뷰 모드 복귀, 새 메모면 placeholder
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
    const res = await fetch(`${API}/memos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    saved = await res.json();
    currentId = saved.id;
  } else {
    const res = await fetch(`${API}/memos/${currentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    saved = await res.json();
  }

  await fetchMemos();
  showViewPane(saved);
  showToast('저장했습니다.');
}

async function deleteMemo() {
  if (!currentId) return;
  if (!confirm('이 메모를 삭제하시겠습니까?')) return;
  await fetch(`${API}/memos/${currentId}`, { method: 'DELETE' });
  currentId = null;
  document.getElementById('view-pane').style.display = 'none';
  document.getElementById('edit-pane').style.display = 'none';
  document.getElementById('placeholder').style.display = 'flex';
  await fetchMemos();
  showToast('삭제했습니다.');
}

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

fetchMemos();
