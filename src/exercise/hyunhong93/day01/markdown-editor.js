const STORAGE_KEY = 'md-editor-content';

const editor    = document.getElementById('editor');
const preview   = document.getElementById('preview');
const statusText = document.getElementById('statusText');
const saveIndicator = document.getElementById('saveIndicator');

const DEFAULT_CONTENT = `# 마크다운 에디터 👋

## 소개
**굵게**, *기울임*, ~~취소선~~ 텍스트를 사용할 수 있어요.

## 코드
인라인 \`코드\`와 코드 블록:

\`\`\`js
function hello() {
  console.log("Hello, Markdown!");
}
\`\`\`

## 목록
- 항목 1
- 항목 2
  - 중첩 항목

1. 첫 번째
2. 두 번째

## 인용
> 마크다운으로 빠르게 문서를 작성하세요.

## 링크
[GitHub](https://github.com)

---
*즐거운 코딩!*
`;

// 저장 인디케이터
let hideTimer = null;
function showSaved() {
  saveIndicator.classList.remove('hidden');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => saveIndicator.classList.add('hidden'), 2000);
}

// localStorage 저장
let saveTimer = null;
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, editor.value);
  showSaved();
}

// 렌더링 + 상태 업데이트
function render() {
  preview.innerHTML = marked.parse(editor.value);
  const chars = editor.value.length;
  const lines = editor.value.split('\n').length;
  statusText.textContent = `${chars.toLocaleString()} 글자 · ${lines} 줄`;
}

// 입력 시 렌더링 + 디바운스 저장
editor.addEventListener('input', () => {
  render();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToStorage, 500);
});

// 툴바 액션
const actions = {
  h1:     { prefix: '# ',   suffix: '' },
  h2:     { prefix: '## ',  suffix: '' },
  h3:     { prefix: '### ', suffix: '' },
  bold:   { prefix: '**',   suffix: '**' },
  italic: { prefix: '*',    suffix: '*' },
  strike: { prefix: '~~',   suffix: '~~' },
  code:   { prefix: '`',    suffix: '`' },
  quote:  { prefix: '> ',   suffix: '' },
  ul:     { prefix: '- ',   suffix: '' },
  ol:     { prefix: '1. ',  suffix: '' },
  hr:     { prefix: '\n---\n', suffix: '' },
};

document.querySelectorAll('.tb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    const start  = editor.selectionStart;
    const end    = editor.selectionEnd;
    const sel    = editor.value.substring(start, end);

    if (action === 'link') {
      const url = prompt('URL을 입력하세요:', 'https://');
      if (!url) return;
      editor.setRangeText(`[${sel || '링크 텍스트'}](${url})`, start, end, 'end');
    } else if (action === 'codeblock') {
      editor.setRangeText(`\`\`\`\n${sel || '// 코드'}\n\`\`\``, start, end, 'end');
    } else if (actions[action]) {
      const { prefix, suffix } = actions[action];
      editor.setRangeText(prefix + (sel || '') + suffix, start, end, 'select');
    }

    editor.focus();
    render();
    saveToStorage();
  });
});

// 뷰 모드 전환
function setView(mode) {
  document.getElementById('editorWrap').className = 'editor-wrap view-' + mode;
  document.getElementById('btn-split').classList.toggle('active',   mode === 'split');
  document.getElementById('btn-edit').classList.toggle('active',    mode === 'edit');
  document.getElementById('btn-preview').classList.toggle('active', mode === 'preview');
}

// Tab 키 들여쓰기
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = editor.selectionStart;
    editor.setRangeText('  ', s, s, 'end');
    render();
  }
});

// 다크/라이트 모드 토글
const themeToggle = document.getElementById('themeToggle');

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem('md-editor-theme', theme);
}

themeToggle.addEventListener('click', () => {
  const current = document.body.dataset.theme;
  applyTheme(current === 'light' ? 'dark' : 'light');
});

// 초기화: localStorage 또는 기본값 로드
editor.value = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CONTENT;
applyTheme(localStorage.getItem('md-editor-theme') ?? 'dark');
setView('split');
render();
