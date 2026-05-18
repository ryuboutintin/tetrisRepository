const API_URL = "/memos";

const memoForm = document.getElementById("memo-form");
const memoList = document.getElementById("memo-list");
const formTitle = document.getElementById("form-title");
const memoIdInput = document.getElementById("memo-id");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");

// 페이지 로드 시 메모 목록 불러오기
document.addEventListener("DOMContentLoaded", loadMemos);

// 폼 제출 이벤트
memoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !content) return;

    const memoId = memoIdInput.value;

    if (memoId) {
        // 수정 모드
        await updateMemo(memoId, { title, content });
    } else {
        // 생성 모드
        await createMemo({ title, content });
    }

    resetForm();
    loadMemos();
});

// 취소 버튼
cancelBtn.addEventListener("click", resetForm);

// 메모 목록 불러오기
async function loadMemos() {
    const response = await fetch(API_URL);
    const memos = await response.json();

    if (memos.length === 0) {
        memoList.innerHTML = '<p class="empty-message">아직 작성된 메모가 없습니다.</p>';
        return;
    }

    memoList.innerHTML = memos.map((memo) => `
        <div class="memo-card">
            <h3>${escapeHtml(memo.title)}</h3>
            <p>${escapeHtml(memo.content)}</p>
            <div class="meta">
                작성: ${formatDate(memo.created_at)} | 수정: ${formatDate(memo.updated_at)}
            </div>
            <div class="actions">
                <button class="btn-edit" onclick="editMemo(${memo.id})">수정</button>
                <button class="btn-delete" onclick="deleteMemo(${memo.id})">삭제</button>
            </div>
        </div>
    `).join("");
}

// 메모 생성
async function createMemo(data) {
    await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
}

// 메모 수정 폼 채우기
async function editMemo(id) {
    const response = await fetch(`${API_URL}/${id}`);
    const memo = await response.json();

    memoIdInput.value = memo.id;
    titleInput.value = memo.title;
    contentInput.value = memo.content;

    formTitle.textContent = "메모 수정";
    submitBtn.textContent = "수정";
    cancelBtn.style.display = "inline-block";

    // 폼으로 스크롤
    memoForm.scrollIntoView({ behavior: "smooth" });
}

// 메모 수정 요청
async function updateMemo(id, data) {
    await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
}

// 메모 삭제
async function deleteMemo(id) {
    if (!confirm("정말 이 메모를 삭제하시겠습니까?")) return;

    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    loadMemos();
}

// 폼 초기화
function resetForm() {
    memoIdInput.value = "";
    titleInput.value = "";
    contentInput.value = "";
    formTitle.textContent = "새 메모 작성";
    submitBtn.textContent = "저장";
    cancelBtn.style.display = "none";
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// 날짜 포맷
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
