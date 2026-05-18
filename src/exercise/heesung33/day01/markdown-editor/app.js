const editor = document.getElementById('editor');
const preview = document.getElementById('preview');

function parseMarkdown(text) {
    let html = text;

    // 코드 블록 (``` ... ```)
    html = html.replace(/```([\s\S]*?)```/g, function (match, code) {
        const escaped = escapeHtml(code.trim());
        return '<pre><code>' + escaped + '</code></pre>';
    });

    // 인라인 코드 (`code`)
    html = html.replace(/`([^`]+)`/g, function (match, code) {
        return '<code>' + escapeHtml(code) + '</code>';
    });

    // 수평선
    html = html.replace(/^---$/gm, '<hr>');

    // 헤딩
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 인용문
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // 볼드, 이탤릭
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 이미지
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // 링크
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 비순서 리스트
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // 순서 리스트
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((<li>.*<\/li>\n?)+)/g, function (match) {
        if (match.includes('<ul>')) return match;
        return '<ol>' + match + '</ol>';
    });

    // 문단 처리
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // 빈 태그 정리
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ol>)/g, '$1');
    html = html.replace(/(<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');

    return html;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function (char) {
        return map[char];
    });
}

function render() {
    preview.innerHTML = parseMarkdown(editor.value);
}

editor.addEventListener('input', render);

render();
