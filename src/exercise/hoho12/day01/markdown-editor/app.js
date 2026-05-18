const STORAGE_KEY = 'md-editor-content';
const SAVE_DELAY = 800;

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const saveStatus = document.getElementById('save-status');
const divider = document.getElementById('divider');
const editorPane = document.querySelector('.pane-editor');
const previewPane = document.querySelector('.pane-preview');

// ─── 렌더링 ──────────────────────────────────────────────────────
const MARKED_OPTIONS = { breaks: true, gfm: true };

function render() {
  preview.innerHTML = marked.parse(editor.value, MARKED_OPTIONS);
}

// ─── localStorage 자동 저장 ───────────────────────────────────────
let saveTimer = null;

function markUnsaved() {
  saveStatus.textContent = '저장 중...';
  saveStatus.classList.add('unsaved');
}

function save() {
  localStorage.setItem(STORAGE_KEY, editor.value);
  saveStatus.textContent = '저장됨 ✓';
  saveStatus.classList.remove('unsaved');
}

function scheduleSave() {
  markUnsaved();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, SAVE_DELAY);
}

// ─── 초기 로드 ───────────────────────────────────────────────────
const saved = localStorage.getItem(STORAGE_KEY);
if (saved !== null) {
  editor.value = saved;
} else {
  editor.value = `# 마크다운 에디터에 오신 것을 환영합니다!

## 기능 안내

- **굵게**, *기울임*, \`인라인 코드\` 를 지원합니다.
- 실시간 미리보기가 우측에 표시됩니다.
- 내용은 **localStorage** 에 자동 저장됩니다.

## 코드 블록

\`\`\`javascript
function hello() {
  console.log("Hello, Markdown!");
}
\`\`\`

## 표

| 항목 | 설명 |
|------|------|
| 편집 | 왼쪽 입력창 |
| 미리보기 | 오른쪽 결과 |

> 팁: 툴바 버튼으로 빠르게 마크다운 문법을 삽입할 수 있습니다.
`;
}

render();
save();

// ─── 입력 이벤트 ─────────────────────────────────────────────────
editor.addEventListener('input', () => {
  render();
  scheduleSave();
});

// ─── 툴바 버튼 헬퍼 ──────────────────────────────────────────────
function insertAround(before, after) {
  const { selectionStart: s, selectionEnd: e, value } = editor;
  const selected = value.slice(s, e);
  const replacement = before + selected + after;
  editor.setRangeText(replacement, s, e, 'select');
  editor.focus();
  if (!selected) {
    // 선택 없으면 커서를 앞 마커 직후로 이동
    editor.setSelectionRange(s + before.length, s + before.length);
  }
  render();
  scheduleSave();
}

function insertLinePrefix(prefix) {
  const { selectionStart: s, selectionEnd: e, value } = editor;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  const lineEnd = value.indexOf('\n', e);
  const end = lineEnd === -1 ? value.length : lineEnd;
  const lines = value.slice(lineStart, end).split('\n');
  const prefixed = lines.map(l => prefix + l).join('\n');
  editor.setRangeText(prefixed, lineStart, end, 'end');
  editor.focus();
  render();
  scheduleSave();
}

document.getElementById('btn-bold').addEventListener('click', () => insertAround('**', '**'));
document.getElementById('btn-italic').addEventListener('click', () => insertAround('*', '*'));
document.getElementById('btn-h1').addEventListener('click', () => insertLinePrefix('# '));
document.getElementById('btn-h2').addEventListener('click', () => insertLinePrefix('## '));
document.getElementById('btn-ul').addEventListener('click', () => insertLinePrefix('- '));
document.getElementById('btn-code').addEventListener('click', () => insertAround('`', '`'));
document.getElementById('btn-link').addEventListener('click', () => {
  const { selectionStart: s, selectionEnd: e, value } = editor;
  const selected = value.slice(s, e) || '링크 텍스트';
  const replacement = `[${selected}](url)`;
  editor.setRangeText(replacement, s, e, 'end');
  editor.focus();
  render();
  scheduleSave();
});

// ─── 초기화 버튼 ─────────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('모든 내용을 지우시겠습니까?')) return;
  editor.value = '';
  render();
  save();
});

// ─── 키보드 단축키 ───────────────────────────────────────────────
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    insertAround('  ', '');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    insertAround('**', '**');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    insertAround('*', '*');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    clearTimeout(saveTimer);
    save();
  }
});

// ─── 드래그로 구분선 크기 조절 ───────────────────────────────────
let dragging = false;

divider.addEventListener('mousedown', e => {
  dragging = true;
  divider.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (!dragging) return;
  const layout = editorPane.parentElement;
  const rect = layout.getBoundingClientRect();
  const isRow = getComputedStyle(layout).flexDirection === 'row';

  if (isRow) {
    const offset = e.clientX - rect.left;
    const total = rect.width - divider.offsetWidth;
    const pct = Math.min(Math.max(offset / total * 100, 15), 85);
    editorPane.style.flex = `0 0 ${pct}%`;
    previewPane.style.flex = `0 0 ${100 - pct}%`;
  } else {
    const offset = e.clientY - rect.top;
    const total = rect.height - divider.offsetHeight;
    const pct = Math.min(Math.max(offset / total * 100, 15), 85);
    editorPane.style.flex = `0 0 ${pct}%`;
    previewPane.style.flex = `0 0 ${100 - pct}%`;
  }
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  divider.classList.remove('dragging');
});
