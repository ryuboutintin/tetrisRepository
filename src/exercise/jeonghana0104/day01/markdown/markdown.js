const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const buddy = document.getElementById('buddy');
const bubble = document.getElementById('bubble');
const spellPanel = document.getElementById('spellPanel');
const spellBody = document.getElementById('spellBody');
const spellCount = document.getElementById('spellCount');
const spellClose = document.getElementById('spellClose');
const spellFixAll = document.getElementById('spellFixAll');
const themeToggle = document.getElementById('themeToggle');

// ===== Theme =====
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = themeToggle.querySelector('.icon');
  const label = themeToggle.querySelector('.label');
  if (theme === 'dark') {
    icon.textContent = '☀';
    label.textContent = '라이트 모드';
  } else {
    icon.textContent = '🌙';
    label.textContent = '다크 모드';
  }
  localStorage.setItem('claude-md-theme', theme);
}

const savedTheme = localStorage.getItem('claude-md-theme');
const initialTheme = savedTheme
  || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(initialTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ===== Render =====
function render() {
  preview.innerHTML = marked.parse(editor.value);
  const len = editor.value.length;
  status.textContent = `자동 저장됨 · ${len}자`;
  localStorage.setItem('claude-md', editor.value);
}

const saved = localStorage.getItem('claude-md');
if (saved !== null && saved.trim() !== '') editor.value = saved;
render();
editor.addEventListener('input', render);

// ===== Toolbar actions =====
function wrap(before, after = before) {
  const s = editor.selectionStart;
  const e = editor.selectionEnd;
  const sel = editor.value.slice(s, e);
  const replaced = before + (sel || '텍스트') + after;
  editor.setRangeText(replaced, s, e, 'end');
  editor.focus();
  render();
}

function prefixLines(prefix) {
  const s = editor.selectionStart;
  const e = editor.selectionEnd;
  const before = editor.value.slice(0, s);
  const sel = editor.value.slice(s, e) || '항목';
  const after = editor.value.slice(e);
  const lines = sel.split('\n').map((l, i) => {
    if (prefix === '1. ') return `${i + 1}. ${l}`;
    return prefix + l;
  }).join('\n');
  editor.value = before + lines + after;
  editor.focus();
  render();
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const a = btn.dataset.action;
    switch (a) {
      case 'bold': wrap('**'); break;
      case 'italic': wrap('*'); break;
      case 'strike': wrap('~~'); break;
      case 'h1': prefixLines('# '); break;
      case 'h2': prefixLines('## '); break;
      case 'h3': prefixLines('### '); break;
      case 'ul': prefixLines('- '); break;
      case 'ol': prefixLines('1. '); break;
      case 'quote': prefixLines('> '); break;
      case 'code': wrap('`'); break;
      case 'codeblock': wrap('\n```\n', '\n```\n'); break;
      case 'link': wrap('[', '](https://)'); break;
      case 'spellcheck': openSpellPanel(); break;
      case 'clear':
        if (confirm('편집기 내용을 모두 지우시겠어요?')) {
          editor.value = '';
          render();
        }
        break;
      case 'download':
        const blob = new Blob([editor.value], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'document.md';
        link.click();
        URL.revokeObjectURL(url);
        say('마크다운 파일을 저장했어요! 📥');
        break;
    }
  });
});

editor.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b') { e.preventDefault(); wrap('**'); }
    if (e.key === 'i') { e.preventDefault(); wrap('*'); }
  }
});

// ===== Korean spell check =====
// 흔하게 틀리는 한국어 표현 사전 (국립국어원 표준어 기준)
const KOREAN_TYPOS = [
  { wrong: '안되요',   right: '안 돼요',  reason: "'안 되어요'의 준말은 '안 돼요'" },
  { wrong: '안되',     right: '안 돼',    reason: "'안'은 띄어쓰고 종결은 '돼'" },
  { wrong: '되요',     right: '돼요',     reason: "'되어요'의 준말은 '돼요'" },
  { wrong: '되서',     right: '돼서',     reason: "'되어서'의 준말은 '돼서'" },
  { wrong: '할께',     right: '할게',     reason: "어미 '-ㄹ게'는 된소리로 적지 않음" },
  { wrong: '갈께',     right: '갈게',     reason: "어미 '-ㄹ게'는 된소리로 적지 않음" },
  { wrong: '끝낼께',   right: '끝낼게',   reason: "어미 '-ㄹ게'는 된소리로 적지 않음" },
  { wrong: '할꺼야',   right: '할 거야',  reason: "'할 것이야'의 준말은 '할 거야'" },
  { wrong: '갈꺼야',   right: '갈 거야',  reason: "'갈 것이야'의 준말은 '갈 거야'" },
  { wrong: '어떻해',   right: '어떡해',   reason: "'어떻게 해'의 준말은 '어떡해'" },
  { wrong: '왠만하면', right: '웬만하면', reason: "'웬만하다'가 올바른 표기" },
  { wrong: '왠지모르', right: '왠지 모르', reason: "'왠지'는 띄어 사용" },
  { wrong: '몇일',     right: '며칠',     reason: "'며칠'이 표준어 (몇일은 비표준)" },
  { wrong: '바램',     right: '바람',     reason: "'바라다'의 명사형은 '바람'" },
  { wrong: '깨끗히',   right: '깨끗이',   reason: "'깨끗이'가 표준 표기" },
  { wrong: '일일히',   right: '일일이',   reason: "'일일이'가 표준 표기" },
  { wrong: '햇갈',     right: '헷갈',     reason: "'헷갈리다'가 표준어" },
  { wrong: '설겆이',   right: '설거지',   reason: "'설거지'가 표준 표기" },
  { wrong: '어의없',   right: '어이없',   reason: "'어이없다'가 표준어" },
  { wrong: '역활',     right: '역할',     reason: "'역할'이 올바른 표기" },
  { wrong: '오랫만',   right: '오랜만',   reason: "'오랜만'이 표준 표기" },
  { wrong: '뵈요',     right: '봬요',     reason: "'뵈어요'의 준말은 '봬요'" },
  { wrong: '뵈서',     right: '봬서',     reason: "'뵈어서'의 준말은 '봬서'" },
  { wrong: '들리다 ',  right: '들르다 ',  reason: "(들르다: 거치다 / 들리다: 소리가 나다)" },
  { wrong: '맞추다',   right: '맞히다',   reason: "정답 맞히기는 '맞히다' (조립은 '맞추다')" },
  { wrong: '몇 일',    right: '며칠',     reason: "'며칠'이 표준어" },
  { wrong: '돼는',     right: '되는',     reason: "관형사형 '-는' 앞은 '되-'" },
];

let currentErrors = [];

function findErrors() {
  const text = editor.value;
  const errors = [];
  for (const rule of KOREAN_TYPOS) {
    let idx = 0;
    while ((idx = text.indexOf(rule.wrong, idx)) !== -1) {
      errors.push({ ...rule, index: idx });
      idx += rule.wrong.length;
    }
  }
  return errors.sort((a, b) => a.index - b.index);
}

function renderSpellPanel() {
  currentErrors = findErrors();
  spellCount.textContent = currentErrors.length > 0 ? ` · ${currentErrors.length}건` : '';
  spellBody.innerHTML = '';
  if (currentErrors.length === 0) {
    spellBody.innerHTML = '<div class="spell-empty">맞춤법 의심 표현을 찾지 못했어요 ✨</div>';
    spellFixAll.disabled = true;
    return;
  }
  spellFixAll.disabled = false;
  currentErrors.forEach((err, i) => {
    const item = document.createElement('div');
    item.className = 'spell-item';
    const pair = document.createElement('div');
    pair.className = 'pair';
    const wrong = document.createElement('span');
    wrong.className = 'wrong';
    wrong.textContent = err.wrong;
    const arrow = document.createTextNode(' → ');
    const right = document.createElement('span');
    right.className = 'right';
    right.textContent = err.right;
    const reason = document.createElement('div');
    reason.className = 'reason';
    reason.textContent = err.reason;
    pair.append(wrong, arrow, right, reason);
    const btn = document.createElement('button');
    btn.textContent = '수정';
    btn.addEventListener('click', () => fixOne(i));
    item.append(pair, btn);
    spellBody.appendChild(item);
  });
}

function fixOne(idx) {
  const err = currentErrors[idx];
  if (!err) return;
  const text = editor.value;
  const at = text.indexOf(err.wrong);
  if (at < 0) { renderSpellPanel(); return; }
  editor.value = text.slice(0, at) + err.right + text.slice(at + err.wrong.length);
  render();
  renderSpellPanel();
}

function fixAll() {
  let text = editor.value;
  let fixedCount = 0;
  for (const rule of KOREAN_TYPOS) {
    const parts = text.split(rule.wrong);
    if (parts.length > 1) {
      fixedCount += parts.length - 1;
      text = parts.join(rule.right);
    }
  }
  editor.value = text;
  render();
  renderSpellPanel();
  say(`${fixedCount}개 표현을 한 번에 수정했어요! ✓`);
}

function openSpellPanel() {
  renderSpellPanel();
  spellPanel.classList.add('show');
  const n = currentErrors.length;
  if (n === 0) say('맞춤법 문제를 찾지 못했어요! 글솜씨가 멋져요 ✨');
  else say(`${n}개의 의심 표현을 찾았어요. 왼쪽 패널에서 확인해 보세요!`);
}

spellClose.addEventListener('click', () => spellPanel.classList.remove('show'));
spellFixAll.addEventListener('click', fixAll);

// ===== Claude buddy chat =====
const tips = [
  "팁: **굵게** 표시는 Ctrl+B로 빠르게 적용할 수 있어요!",
  "글이 길어지면 ## 부제목으로 정리해 보세요 ✨",
  "코드 블록은 ``` 세 개로 감쌀 수 있어요!",
  "툴바의 ✓ 버튼으로 한글 맞춤법을 점검할 수 있어요!",
  "> 인용문은 글에 무게감을 더해줘요.",
  "자동 저장 중이니 안심하고 작성하세요 💾",
  "Markdown은 .md 확장자로 저장된답니다!",
  "오른쪽 위 버튼으로 다크/라이트 모드를 바꿀 수 있어요 🌙",
  "저는 Claude Code의 픽셀 친구예요!"
];

let bubbleTimer;
function say(msg) {
  bubble.textContent = msg;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 4500);
}

buddy.addEventListener('click', () => {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  say(tip);
});

setTimeout(() => say('안녕하세요! 저는 Claude Code의 픽셀 친구예요 ✨ 클릭해 보세요!'), 700);
