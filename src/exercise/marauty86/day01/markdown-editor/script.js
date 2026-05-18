const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

let saveTimeout;

const defaultContent = `# Modern Markdown Editor

좌측 창에 내용을 입력하면 우측에서 실시간으로 확인할 수 있습니다.

## 주요 기능
- **실시간 미리보기**: 작성 즉시 우측 화면에 반영됩니다.
- **자동 저장**: 모든 내용은 브라우저의 \`localStorage\`에 안전하게 보관됩니다.
- **세련된 UI**: 다크 모드 헤더와 깔끔한 타이포그래피를 적용했습니다.

### 코드 예시
\`\`\`javascript
function hello() {
  console.log("Hello, Markdown!");
}
\`\`\`

> 이 에디터는 **marked.js** 라이브러리를 사용합니다.

자유롭게 편집해 보세요!`;

// Initialize
const savedContent = localStorage.getItem('markdown-content');
if (savedContent) {
    editor.value = savedContent;
    updatePreview(savedContent);
} else {
    editor.value = defaultContent;
    updatePreview(defaultContent);
}

// Event Listeners
editor.addEventListener('input', (e) => {
    const content = e.target.value;
    updatePreview(content);
    
    // Status feedback
    status.textContent = '저장 중...';
    status.classList.add('saving');
    
    // Debounce saving
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveToLocalStorage(content);
        status.textContent = '저장 완료';
        status.classList.remove('saving');
    }, 500);
});

function updatePreview(markdownText) {
    if (typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(markdownText);
    } else {
        preview.innerHTML = '<p style="color: red;">라이브러리 로드 오류</p>';
    }
}

function saveToLocalStorage(content) {
    localStorage.setItem('markdown-content', content);
}

console.log('Modern Markdown Editor Ready.');
