const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const clearBtn = document.getElementById('clearBtn');

// ─── 초기 마크다운 ───
const initialMd = `# 마크다운 에디터

## 사용법

왼쪽에 **마크다운**을 입력하면 오른쪽에 *미리보기*가 실시간으로 표시됩니다.

### 지원 기능

- 굵게: **텍스트**
- 기울임: *텍스트*
- 취소선: ~~텍스트~~
- 인라인 코드: \`code\`
- [링크](https://example.com)

\`\`\`javascript
// 코드 블록
const greet = name => \`Hello, \${name}!\`;
console.log(greet('World'));
\`\`\`

> 인용문도 지원됩니다.

| 항목 | 내용 |
|------|------|
| 에디터 | Markdown |
| 스타일 | Material Design |
| 파싱 | marked.js |

---

**즐거운 코딩 되세요!** 🎉
`;

// ─── 마크다운 → HTML 렌더링 ───
marked.setOptions({ breaks: true, gfm: true });

function render() {
  const md = editor.value.trim();
  if (md === '') {
    preview.innerHTML = '<p class="empty-hint">왼쪽에 마크다운을 입력하면 미리보기가 표시됩니다.</p>';
  } else {
    preview.innerHTML = marked.parse(editor.value);
  }
}

editor.addEventListener('input', render);

// ─── 테마 전환 ───
let isDark = false;

themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('light', !isDark);
  themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
});

// ─── 메뉴바 액션 ───
const templates = {
  h1:            { wrap: false, text: '# 제목 1\n' },
  h2:            { wrap: false, text: '## 제목 2\n' },
  h3:            { wrap: false, text: '### 제목 3\n' },
  bold:          { wrap: true,  before: '**', after: '**', placeholder: '굵은 텍스트' },
  italic:        { wrap: true,  before: '*',  after: '*',  placeholder: '기울인 텍스트' },
  strikethrough: { wrap: true,  before: '~~', after: '~~', placeholder: '취소선 텍스트' },
  quote:         { wrap: false, text: '> 인용문\n' },
  code:          { wrap: true,  before: '`',  after: '`',  placeholder: 'code' },
  codeblock:     { wrap: false, text: '```javascript\n// 코드 입력\n```\n' },
  link:          { wrap: false, text: '[링크 텍스트](https://example.com)' },
  ul:            { wrap: false, text: '- 항목 1\n- 항목 2\n- 항목 3\n' },
  ol:            { wrap: false, text: '1. 항목 1\n2. 항목 2\n3. 항목 3\n' },
  table:         { wrap: false, text: '| 컬럼1 | 컬럼2 | 컬럼3 |\n|-------|-------|-------|\n| 값1   | 값2   | 값3   |\n' },
};

function insertText(action) {
  const t = templates[action];
  if (!t) return;

  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end);
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);

  let inserted;
  if (t.wrap) {
    const content = selected || t.placeholder;
    inserted = t.before + content + t.after;
    editor.value = before + inserted + after;
    const cursorStart = start + t.before.length;
    const cursorEnd = cursorStart + content.length;
    editor.setSelectionRange(cursorStart, cursorEnd);
  } else {
    const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    inserted = prefix + t.text;
    editor.value = before + inserted + after;
    editor.setSelectionRange(start + inserted.length, start + inserted.length);
  }

  editor.focus();
  render();
}

document.querySelectorAll('.menu-btn[data-action]').forEach(btn => {
  btn.addEventListener('click', () => insertText(btn.dataset.action));
});

// ─── 초기화 ───
clearBtn.addEventListener('click', () => {
  if (confirm('내용을 모두 지우겠습니까?')) {
    editor.value = '';
    render();
  }
});

// ─── 탭 키 지원 ───
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = editor.selectionStart;
    editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(editor.selectionEnd);
    editor.setSelectionRange(s + 2, s + 2);
  }
});

// ─── 초기 렌더링 ───
editor.value = initialMd;
render();
