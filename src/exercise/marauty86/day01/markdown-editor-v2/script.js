const markdownInput = document.getElementById('markdown-input');
const htmlOutput = document.getElementById('html-output');
const saveStatus = document.getElementById('save-status');
const clearBtn = document.getElementById('clear-btn');

let saveTimeout;

const STORAGE_KEY = 'markdown-v2-content';

const defaultText = `# Markdown Editor v2

이곳에 마크다운을 작성하세요!

## 기능
- **실시간 미리보기**: 작성 즉시 확인 가능
- **자동 저장**: 로컬 스토리지에 자동 저장
- **XSS 방지**: DOMPurify 적용으로 안전한 렌더링
- **다크 모드**: 세련된 GitHub 스타일 테마

### 코드 예시
\`\`\`javascript
console.log("Hello, World!");
\`\`\`

> 즐겁게 작성해 보세요!`;

// Initialize
function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        markdownInput.value = saved;
    } else {
        markdownInput.value = defaultText;
    }
    updatePreview();
}

// Update Preview with Security Sanitization
function updatePreview() {
    const rawMarkdown = markdownInput.value;
    
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        const rawHtml = marked.parse(rawMarkdown);
        const cleanHtml = DOMPurify.sanitize(rawHtml);
        htmlOutput.innerHTML = cleanHtml;
    } else {
        htmlOutput.innerHTML = '<p style="color:red">라이브러리를 로드할 수 없습니다.</p>';
    }
}

// Auto-save with Debounce
function handleInput() {
    updatePreview();
    
    saveStatus.textContent = '저장 중...';
    saveStatus.classList.add('saving');
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, markdownInput.value);
        saveStatus.textContent = '저장 완료';
        saveStatus.classList.remove('saving');
    }, 800);
}

// Event Listeners
markdownInput.addEventListener('input', handleInput);

clearBtn.addEventListener('click', () => {
    if (confirm('작성 중인 모든 내용을 초기화하시겠습니까?')) {
        markdownInput.value = '';
        handleInput();
        markdownInput.focus();
    }
});

// Run
init();
