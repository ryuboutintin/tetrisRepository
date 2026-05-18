const API = '/memos';
const memoData = new Map();
let allMemos = [];
let currentFilter = null;

const token = localStorage.getItem('token');
if (!token) location.href = '/login';

async function authFetch(url, options = {}) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        localStorage.removeItem('token');
        location.href = '/login';
    }
    return res;
}

async function loadMemos() {
    const res = await authFetch(API);
    allMemos = await res.json();
    renderTagFilter(allMemos);
    renderMemos(filterMemos(allMemos));
}

function filterMemos(memos) {
    if (!currentFilter) return memos;
    return memos.filter(m =>
        m.tags && m.tags.split(',').map(t => t.trim()).includes(currentFilter)
    );
}

function renderTagFilter(memos) {
    const tags = [...new Set(
        memos.flatMap(m => m.tags ? m.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
    )];
    const bar = document.getElementById('tag-filter');
    if (tags.length === 0) {
        bar.innerHTML = '';
        return;
    }
    bar.innerHTML =
        `<button data-tag="" class="${!currentFilter ? 'active' : ''}">전체</button>` +
        tags.map(t =>
            `<button data-tag="${escHtml(t)}" class="${currentFilter === t ? 'active' : ''}">${escHtml(t)}</button>`
        ).join('');
    bar.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => setFilter(btn.dataset.tag || null));
    });
}

function setFilter(tag) {
    currentFilter = tag;
    renderTagFilter(allMemos);
    renderMemos(filterMemos(allMemos));
}

function renderMemos(memos) {
    memoData.clear();
    const list = document.getElementById('memo-list');
    if (memos.length === 0) {
        list.innerHTML = '<p class="empty">메모가 없습니다.</p>';
        return;
    }
    memos.forEach(m => memoData.set(m.id, m));
    list.innerHTML = memos.map(memoCard).join('');
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function memoCard(m) {
    const tagBadges = m.tags
        ? m.tags.split(',').map(t => t.trim()).filter(Boolean)
              .map(t => `<span class="tag">${escHtml(t)}</span>`).join('')
        : '';
    const created = new Date(m.created_at).toLocaleString('ko-KR');
    const updated = new Date(m.updated_at).toLocaleString('ko-KR');
    return `
    <div class="memo-card" id="card-${m.id}">
        <h3>${escHtml(m.title)}</h3>
        <div class="content">${escHtml(m.content)}</div>
        <div class="tags">${tagBadges}</div>
        <div class="meta">작성: ${created} · 수정: ${updated}</div>
        <div class="card-actions">
            <button class="btn-primary" onclick="showEditForm(${m.id})">수정</button>
            <button class="btn-danger" onclick="deleteMemo(${m.id})">삭제</button>
        </div>
    </div>`;
}

function showEditForm(id) {
    const m = memoData.get(id);
    const card = document.getElementById(`card-${id}`);
    card.innerHTML = `
    <div class="edit-form">
        <input type="text" id="edit-title-${id}" value="${escHtml(m.title)}">
        <textarea id="edit-content-${id}" rows="4">${escHtml(m.content)}</textarea>
        <input type="text" id="edit-tags-${id}" value="${escHtml(m.tags)}">
        <div class="edit-actions">
            <button class="btn-primary" onclick="submitEdit(${id})">저장</button>
            <button class="btn-secondary" onclick="loadMemos()">취소</button>
        </div>
    </div>`;
}

async function submitEdit(id) {
    const body = {
        title: document.getElementById(`edit-title-${id}`).value,
        content: document.getElementById(`edit-content-${id}`).value,
        tags: document.getElementById(`edit-tags-${id}`).value,
    };
    await authFetch(`${API}/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    loadMemos();
}

async function deleteMemo(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    await authFetch(`${API}/${id}`, { method: 'DELETE' });
    loadMemos();
}

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    location.href = '/login';
});

document.getElementById('memo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        title: document.getElementById('title').value,
        content: document.getElementById('content').value,
        tags: document.getElementById('tags').value,
    };
    await authFetch(API, { method: 'POST', body: JSON.stringify(body) });
    e.target.reset();
    loadMemos();
});

document.addEventListener('DOMContentLoaded', loadMemos);
