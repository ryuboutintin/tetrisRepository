const form = document.getElementById("memo-form");
const formTitle = document.getElementById("form-title");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const submitButton = document.getElementById("submit-button");
const resetButton = document.getElementById("reset-button");
const refreshButton = document.getElementById("refresh-button");
const statusText = document.getElementById("status-text");
const memoList = document.getElementById("memo-list");
const emptyState = document.getElementById("empty-state");

let editingMemoId = null;

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "요청 처리 중 오류가 발생했습니다.");
  }
  return data;
}

function setStatus(message) {
  statusText.textContent = message;
}

function resetForm() {
  editingMemoId = null;
  form.reset();
  formTitle.textContent = "새 메모 작성";
  submitButton.textContent = "저장";
  setStatus("대기 중");
  titleInput.focus();
}

function startEdit(memo) {
  editingMemoId = memo.id;
  titleInput.value = memo.title;
  contentInput.value = memo.content;
  formTitle.textContent = `메모 수정 #${memo.id}`;
  submitButton.textContent = "수정 저장";
  setStatus("수정 모드");
  titleInput.focus();
}

function renderMemos(memos) {
  memoList.innerHTML = "";
  emptyState.hidden = memos.length > 0;

  for (const memo of memos) {
    const item = document.createElement("li");
    item.className = "memo-item";

    const title = document.createElement("h3");
    title.textContent = memo.title;

    const content = document.createElement("p");
    content.textContent = memo.content.trim() || "내용 없음";

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `생성: ${memo.created_at} · 수정: ${memo.updated_at}`;

    const controls = document.createElement("div");
    controls.className = "memo-controls";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "memo-action";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => {
      startEdit(memo);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(`"${memo.title}" 메모를 삭제할까요?`);
      if (!confirmed) {
        return;
      }

      try {
        await request(`/api/memos/${memo.id}`, { method: "DELETE" });
        if (editingMemoId === memo.id) {
          resetForm();
        }
        setStatus("메모를 삭제했습니다.");
        await loadMemos();
      } catch (error) {
        setStatus(error.message);
      }
    });

    controls.append(editButton, deleteButton);
    item.append(title, content, meta, controls);
    memoList.appendChild(item);
  }
}

async function loadMemos() {
  try {
    const memos = await request("/api/memos");
    renderMemos(memos);
    if (!memos.length) {
      setStatus("메모가 비어 있습니다.");
    }
  } catch (error) {
    setStatus(error.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
  };

  if (!payload.title) {
    setStatus("제목을 입력하세요.");
    titleInput.focus();
    return;
  }

  try {
    if (editingMemoId === null) {
      await request("/api/memos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatus("메모를 저장했습니다.");
    } else {
      await request(`/api/memos/${editingMemoId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStatus("메모를 수정했습니다.");
    }

    resetForm();
    await loadMemos();
  } catch (error) {
    setStatus(error.message);
  }
});

resetButton.addEventListener("click", resetForm);
refreshButton.addEventListener("click", loadMemos);

loadMemos();
