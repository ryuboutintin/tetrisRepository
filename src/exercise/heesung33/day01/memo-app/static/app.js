const API_URL = "/memos";
let token = localStorage.getItem("token");

// --- 초기화 ---
document.addEventListener("DOMContentLoaded", () => {
    if (token) {
        showApp();
    }
    setupAuthForms();
    setupMemoForm();
});

// --- 인증 ---
function setupAuthForms() {
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value.trim();

        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData,
        });

        if (res.ok) {
            const data = await res.json();
            token = data.access_token;
            localStorage.setItem("token", token);
            showApp();
        } else {
            const err = await res.json();
            alert(err.detail || "로그인 실패");
        }
    });

    document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("reg-username").value.trim();
        const password = document.getElementById("reg-password").value.trim();

        const res = await fetch("/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (res.ok) {
            alert("회원가입 성공! 로그인해주세요.");
            showTab("login");
        } else {
            const err = await res.json();
            alert(err.detail || "회원가입 실패");
        }
    });
}

function showTab(tab) {
    document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
    document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
    document.getElementById("tab-login").classList.toggle("active", tab === "login");
    document.getElementById("tab-register").classList.toggle("active", tab === "register");
}

async function showApp() {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("app-section").style.display = "block";

    const res = await fetch("/auth/me", { headers: authHeaders() });
    if (res.ok) {
        const user = await res.json();
        document.getElementById("user-info").textContent = `${user.username} 님`;
    } else {
        logout();
        return;
    }
    loadMemos();
}

function logout() {
    token = null;
    localStorage.removeItem("token");
    document.getElementById("auth-section").style.display = "block";
    document.getElementById("app-section").style.display = "none";
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
    };
}

// --- 메모 CRUD ---
function setupMemoForm() {
    const memoForm = document.getElementById("memo-form");
    const cancelBtn = document.getElementById("cancel-btn");

    memoForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("title").value.trim();
        const content = document.getElementById("content").value.trim();
        const category = document.getElementById("category").value;
        const tagsStr = document.getElementById("tags").value.trim();
        const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];

        if (!title || !content) return;

        const memoId = document.getElementById("memo-id").value;
        const data = { title, content, category, tags };

        if (memoId) {
            await fetch(`${API_URL}/${memoId}`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify(data),
            });
        } else {
            await fetch(API_URL, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify(data),
            });
        }

        resetForm();
        loadMemos();
    });

    cancelBtn.addEventListener("click", resetForm);
}

async function loadMemos() {
    const res = await fetch(API_URL, { headers: authHeaders() });
    if (!res.ok) return;

    let memos = await res.json();

    // 클라이언트 필터링
    const filterCategory = document.getElementById("filter-category").value;
    const filterTag = document.getElementById("filter-tag").value.trim().toLowerCase();

    if (filterCategory) {
        memos = memos.filter((m) => m.category === filterCategory);
    }
    if (filterTag) {
        memos = memos.filter((m) => m.tags.some((t) => t.name.toLowerCase().includes(filterTag)));
    }

    const memoList = document.getElementById("memo-list");

    if (memos.length === 0) {
        memoList.innerHTML = '<p class="empty-message">메모가 없습니다.</p>';
        return;
    }

    memoList.innerHTML = memos.map((memo) => `
        <div class="memo-card">
            <h3>${escapeHtml(memo.title)}</h3>
            <p>${escapeHtml(memo.content)}</p>
            <div>
                <span class="category-badge">${escapeHtml(memo.category)}</span>
                ${memo.tags.map((t) => `<span class="tag-badge">#${escapeHtml(t.name)}</span>`).join("")}
            </div>
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

async function editMemo(id) {
    const res = await fetch(`${API_URL}/${id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const memo = await res.json();

    document.getElementById("memo-id").value = memo.id;
    document.getElementById("title").value = memo.title;
    document.getElementById("content").value = memo.content;
    document.getElementById("category").value = memo.category;
    document.getElementById("tags").value = memo.tags.map((t) => t.name).join(", ");

    document.getElementById("form-title").textContent = "메모 수정";
    document.getElementById("submit-btn").textContent = "수정";
    document.getElementById("cancel-btn").style.display = "inline-block";

    document.getElementById("memo-form").scrollIntoView({ behavior: "smooth" });
}

async function deleteMemo(id) {
    if (!confirm("정말 이 메모를 삭제하시겠습니까?")) return;

    await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
    loadMemos();
}

function resetForm() {
    document.getElementById("memo-id").value = "";
    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    document.getElementById("category").value = "일반";
    document.getElementById("tags").value = "";
    document.getElementById("form-title").textContent = "새 메모 작성";
    document.getElementById("submit-btn").textContent = "저장";
    document.getElementById("cancel-btn").style.display = "none";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

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
