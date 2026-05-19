const API = '/api/memos';
let editingId       = null;
let deleteTargetId  = null;
let allMemos        = [];

/* ── Fetch & Render ── */
async function fetchMemos() {
  const res  = await fetch(API);
  allMemos   = await res.json();
  renderMemos(allMemos);
  updateCount(allMemos.length);
}

function updateCount(n) {
  document.getElementById('memoCount').textContent = `${n}개의 메모`;
}

function filterMemos() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = q
    ? allMemos.filter(m =>
        m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q))
    : allMemos;
  renderMemos(filtered);
  updateCount(filtered.length);
}

function renderMemos(memos) {
  const list = document.getElementById('memoList');
  if (memos.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>메모가 없습니다. 새 메모를 작성해 보세요.</p>
      </div>`;
    return;
  }
  list.innerHTML = memos.map(m => {
    const imgHtml = m.image_path
      ? `<img class="card-image" src="${m.image_path}" alt="첨부 이미지"
             onclick="openLightbox('${m.image_path}')" />`
      : '';
    return `
    <div class="memo-card${editingId === m.id ? ' editing' : ''}" id="card-${m.id}">
      ${imgHtml}
      <div class="card-body">
        <span class="memo-chip">MEMO</span>
        <div class="memo-title">${escapeHtml(m.title)}</div>
        <div class="memo-content">${escapeHtml(m.content)}</div>
        <div class="memo-footer">
          <span class="memo-date">${formatDate(m.updated_at)}</span>
          <div class="memo-actions">
            <button class="btn-edit" onclick="startEdit(${m.id})">수정</button>
            <button class="btn-del"  onclick="openDialog(${m.id})">삭제</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── CRUD ── */
async function saveMemo() {
  const title   = document.getElementById('titleInput').value.trim();
  const content = document.getElementById('contentInput').value.trim();
  if (!title || !content) { shakeForm(); return; }

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
    clearForm();
  }
  fetchMemos();
}

async function startEdit(id) {
  const res  = await fetch(`${API}/${id}`);
  const memo = await res.json();
  document.getElementById('titleInput').value   = memo.title;
  document.getElementById('contentInput').value = memo.content;
  document.getElementById('saveBtn').innerHTML  = '<span class="btn-icon">✔</span> 수정 완료';
  document.getElementById('cancelBtn').style.display  = 'inline-flex';
  document.getElementById('formLabel').textContent    = '메모 수정';
  document.getElementById('imageSection').style.display = 'block';

  const wrap = document.getElementById('imagePreviewWrap');
  if (memo.image_path) {
    document.getElementById('imagePreview').src = memo.image_path;
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }

  editingId = id;
  renderMemos(allMemos);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingId = null;
  clearForm();
  document.getElementById('saveBtn').innerHTML  = '<span class="btn-icon">＋</span> 저장하기';
  document.getElementById('cancelBtn').style.display      = 'none';
  document.getElementById('formLabel').textContent        = '새 메모';
  document.getElementById('imageSection').style.display   = 'none';
  document.getElementById('imagePreviewWrap').style.display = 'none';
  renderMemos(allMemos);
}

function clearForm() {
  document.getElementById('titleInput').value   = '';
  document.getElementById('contentInput').value = '';
  document.getElementById('imageInput').value   = '';
}

/* ── Image Upload ── */
async function uploadImage(event) {
  if (editingId === null) return;
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const res  = await fetch(`${API}/${editingId}/image`, { method: 'POST', body: formData });
  const memo = await res.json();

  document.getElementById('imagePreview').src         = memo.image_path;
  document.getElementById('imagePreviewWrap').style.display = 'block';

  const idx = allMemos.findIndex(m => m.id === editingId);
  if (idx !== -1) allMemos[idx] = memo;
  renderMemos(allMemos);
}

async function removeImage() {
  if (editingId === null) return;
  await fetch(`${API}/${editingId}/image`, { method: 'DELETE' });
  document.getElementById('imagePreviewWrap').style.display = 'none';
  document.getElementById('imageInput').value = '';

  const idx = allMemos.findIndex(m => m.id === editingId);
  if (idx !== -1) allMemos[idx].image_path = null;
  renderMemos(allMemos);
}

/* ── Delete dialog ── */
function openDialog(id) {
  deleteTargetId = id;
  document.getElementById('overlay').style.display = 'flex';
}

function closeDialog() {
  deleteTargetId = null;
  document.getElementById('overlay').style.display = 'none';
}

async function confirmDelete() {
  if (deleteTargetId === null) return;
  await fetch(`${API}/${deleteTargetId}`, { method: 'DELETE' });
  if (editingId === deleteTargetId) cancelEdit();
  closeDialog();
  fetchMemos();
}

/* ── Lightbox ── */
function openLightbox(src) {
  document.getElementById('lightboxImg').src         = src;
  document.getElementById('lightbox').style.display  = 'flex';
}

function closeLightbox() {
  document.getElementById('lightbox').style.display = 'none';
}

/* ── Helpers ── */
function shakeForm() {
  const form = document.querySelector('.write-form');
  form.style.animation = 'none';
  requestAnimationFrame(() => { form.style.animation = 'shake .35s ease'; });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

/* ── Global keyframes ── */
const style = document.createElement('style');
style.textContent =
  '@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}';
document.head.appendChild(style);

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDialog(); closeLightbox(); }
});

fetchMemos();
