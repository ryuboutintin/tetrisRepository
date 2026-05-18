const noteList = document.getElementById('note-list');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const newNoteBtn = document.getElementById('new-note-btn');
const status = document.getElementById('status');

let currentNoteId = null;

// API Base URL
const API_URL = '/notes';

// Initialize
async function init() {
    await fetchNotes();
    resetEditor();
}

// Fetch all notes
async function fetchNotes() {
    try {
        const response = await fetch(API_URL + '/');
        const notes = await response.json();
        renderNoteList(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        showStatus('연결 오류', true);
    }
}

// Render note list
function renderNoteList(notes) {
    noteList.innerHTML = '';
    notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    notes.forEach(note => {
        const li = document.createElement('li');
        li.className = `note-item ${currentNoteId === note.id ? 'active' : ''}`;
        li.innerHTML = `
            <h3>${note.title || '제목 없음'}</h3>
            <p>${note.content.substring(0, 30)}${note.content.length > 30 ? '...' : ''}</p>
        `;
        li.onclick = () => selectNote(note);
        noteList.appendChild(li);
    });
}

// Select a note
function selectNote(note) {
    currentNoteId = note.id;
    noteTitle.value = note.title;
    noteContent.value = note.content;
    
    // Update active state in list
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
    fetchNotes(); // Re-render to show active state (or manually find the item)
}

// Save note (Create or Update)
saveBtn.onclick = async () => {
    const title = noteTitle.value.trim() || '제목 없음';
    const content = noteContent.value;
    
    if (!content.trim() && title === '제목 없음') return;

    showStatus('저장 중...');
    
    try {
        let response;
        if (currentNoteId) {
            // Update
            response = await fetch(`${API_URL}/${currentNoteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
        } else {
            // Create
            response = await fetch(`${API_URL}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content })
            });
        }
        
        const savedNote = await response.json();
        currentNoteId = savedNote.id;
        await fetchNotes();
        showStatus('저장 완료');
    } catch (error) {
        console.error('Error saving note:', error);
        showStatus('저장 실패', true);
    }
};

// Delete note
deleteBtn.onclick = async () => {
    if (!currentNoteId) return;
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;

    try {
        await fetch(`${API_URL}/${currentNoteId}`, { method: 'DELETE' });
        currentNoteId = null;
        resetEditor();
        await fetchNotes();
        showStatus('삭제 완료');
    } catch (error) {
        console.error('Error deleting note:', error);
        showStatus('삭제 실패', true);
    }
};

// New note
newNoteBtn.onclick = () => {
    resetEditor();
};

function resetEditor() {
    currentNoteId = null;
    noteTitle.value = '';
    noteContent.value = '';
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
}

function showStatus(text, isError = false) {
    status.textContent = text;
    status.style.color = isError ? '#da3633' : '#8b949e';
    setTimeout(() => {
        status.textContent = '연결됨';
        status.style.color = '#8b949e';
    }, 2000);
}

init();
