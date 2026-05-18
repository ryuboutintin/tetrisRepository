const STORAGE_KEY = 'md-editor-content';
const SAVE_DELAY = 600;

const input = document.getElementById('markdownInput');
const preview = document.getElementById('markdownPreview');
const saveStatus = document.getElementById('saveStatus');
const clearBtn = document.getElementById('clearBtn');

marked.setOptions({
  breaks: true,
  gfm: true,
});

function render(text) {
  preview.innerHTML = marked.parse(text);
}

let saveTimer = null;

function scheduleSave(text) {
  saveStatus.textContent = '저장 중...';
  saveStatus.classList.add('saving');

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, text);
    saveStatus.textContent = '저장됨';
    saveStatus.classList.remove('saving');
  }, SAVE_DELAY);
}

input.addEventListener('input', () => {
  render(input.value);
  scheduleSave(input.value);
});

clearBtn.addEventListener('click', () => {
  if (!input.value) return;
  if (!confirm('작성한 내용을 모두 지우시겠습니까?')) return;
  input.value = '';
  preview.innerHTML = '';
  localStorage.removeItem(STORAGE_KEY);
  saveStatus.textContent = '저장됨';
  saveStatus.classList.remove('saving');
});

// 탭 키 → 공백 2칸 삽입
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const { selectionStart: s, selectionEnd: e2 } = input;
  input.value = input.value.slice(0, s) + '  ' + input.value.slice(e2);
  input.selectionStart = input.selectionEnd = s + 2;
});

// 초기 로드
const saved = localStorage.getItem(STORAGE_KEY) ?? '';
input.value = saved;
render(saved);
