const editor = document.getElementById('editor');
const output = document.getElementById('preview-output');

marked.use({ breaks: true });

function render() {
  output.innerHTML = marked.parse(editor.value);
}

editor.addEventListener('input', render);
render();
