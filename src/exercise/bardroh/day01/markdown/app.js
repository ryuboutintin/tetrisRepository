const STORAGE_KEY = 'md-editor-content';
const THEME_KEY = 'md-editor-theme';

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const saveStatus = document.getElementById('save-status');
const themeBtn = document.getElementById('theme-btn');
const clearBtn = document.getElementById('clear-btn');
const divider = document.getElementById('divider');
const editorPane = document.querySelector('.editor-pane');

// marked 설정
marked.setOptions({
  breaks: true,
  gfm: true,
});

// 초기 로드
const saved = localStorage.getItem(STORAGE_KEY);
if (saved !== null) {
  editor.value = saved;
} else {
  editor.value = `# 마크다운 에디터에 오신 것을 환영합니다!

## 기능 소개

- **실시간** 미리보기
- \`localStorage\` 자동 저장
- 드래그로 창 너비 조절
- 다크 모드 지원

## 코드 예시

\`\`\`javascript
function hello(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## 표

| 항목 | 설명 |
|------|------|
| 편집 | 왼쪽 영역 |
| 미리보기 | 오른쪽 영역 |

> 마크다운을 입력하면 오른쪽에서 바로 확인할 수 있습니다.
`;
}

renderPreview();
loadTheme();

// 렌더링
function renderPreview() {
  preview.innerHTML = marked.parse(editor.value);
}

// 저장 (디바운스 300ms)
let saveTimer = null;
function scheduleSave() {
  saveStatus.textContent = '저장 중...';
  saveStatus.className = 'save-status saving';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, editor.value);
    saveStatus.textContent = '저장됨';
    saveStatus.className = 'save-status';
  }, 300);
}

editor.addEventListener('input', () => {
  renderPreview();
  scheduleSave();
});

// 초기화
clearBtn.addEventListener('click', () => {
  if (!confirm('작성 내용을 모두 지우겠습니까?')) return;
  editor.value = '';
  renderPreview();
  localStorage.removeItem(STORAGE_KEY);
  saveStatus.textContent = '저장됨';
  saveStatus.className = 'save-status';
});

// 다크 모드
function loadTheme() {
  if (localStorage.getItem(THEME_KEY) === 'dark') applyDark();
}

function applyDark() {
  document.body.classList.add('dark');
  themeBtn.textContent = '라이트 모드';
}

function applyLight() {
  document.body.classList.remove('dark');
  themeBtn.textContent = '다크 모드';
}

themeBtn.addEventListener('click', () => {
  if (document.body.classList.contains('dark')) {
    applyLight();
    localStorage.setItem(THEME_KEY, 'light');
  } else {
    applyDark();
    localStorage.setItem(THEME_KEY, 'dark');
  }
});

// 구분선 드래그로 너비 조절
let dragging = false;
let startX = 0;
let startWidth = 0;

divider.addEventListener('mousedown', (e) => {
  dragging = true;
  startX = e.clientX;
  startWidth = editorPane.getBoundingClientRect().width;
  divider.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const delta = e.clientX - startX;
  const containerWidth = editorPane.parentElement.getBoundingClientRect().width;
  const newWidth = Math.min(Math.max(startWidth + delta, 200), containerWidth - 200);
  editorPane.style.flex = 'none';
  editorPane.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  divider.classList.remove('dragging');
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
});

// Tab 키 들여쓰기
editor.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
  editor.selectionStart = editor.selectionEnd = start + 2;
  renderPreview();
  scheduleSave();
});
