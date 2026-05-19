const API = "/memos";

const STORAGE = {
    access: "memo.access_token",
    refresh: "memo.refresh_token",
    username: "memo.username",
};

const els = {
    form: document.getElementById("memoForm"),
    formCard: document.querySelector(".form-card"),
    formTitle: document.getElementById("formTitle"),
    id: document.getElementById("memoId"),
    title: document.getElementById("title"),
    content: document.getElementById("content"),
    submitBtn: document.getElementById("submitBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    list: document.getElementById("list"),
    empty: document.getElementById("empty"),
    count: document.getElementById("count"),
    toast: document.getElementById("toast"),
    userBadge: document.getElementById("userBadge"),
    logoutBtn: document.getElementById("logoutBtn"),
};

// Gatekeeper: bounce to login page if no access token in storage.
if (!localStorage.getItem(STORAGE.access)) {
    window.location.replace("/");
}

let toastTimer;
function toast(message, type = "") {
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        els.toast.hidden = true;
    }, 2000);
}

function fmtTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    const opts = sameDay
        ? { hour: "2-digit", minute: "2-digit" }
        : {
              year: "2-digit",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
          };
    return d.toLocaleString("ko-KR", opts);
}

function escapeHtml(s) {
    return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function clearSessionAndRedirect(message) {
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
    localStorage.removeItem(STORAGE.username);
    if (message) {
        // Pass a one-shot message through sessionStorage so the login page can show it.
        sessionStorage.setItem("memo.flash", message);
    }
    window.location.replace("/");
}

async function tryRefresh() {
    const refresh = localStorage.getItem(STORAGE.refresh);
    if (!refresh) return false;
    try {
        const res = await fetch("/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        localStorage.setItem(STORAGE.access, data.access_token);
        localStorage.setItem(STORAGE.refresh, data.refresh_token);
        return true;
    } catch (_) {
        return false;
    }
}

async function authedFetch(url, opts = {}) {
    const headers = new Headers(opts.headers || {});
    const access = localStorage.getItem(STORAGE.access);
    if (access) headers.set("Authorization", `Bearer ${access}`);

    let res = await fetch(url, { ...opts, headers });
    if (res.status !== 401) return res;

    // Access token may have expired — try a single refresh + retry.
    const refreshed = await tryRefresh();
    if (!refreshed) {
        clearSessionAndRedirect("세션이 만료되었습니다. 다시 로그인하세요.");
        throw new Error("Unauthorized");
    }
    const retryHeaders = new Headers(opts.headers || {});
    retryHeaders.set("Authorization", `Bearer ${localStorage.getItem(STORAGE.access)}`);
    res = await fetch(url, { ...opts, headers: retryHeaders });
    if (res.status === 401) {
        clearSessionAndRedirect("세션이 만료되었습니다. 다시 로그인하세요.");
        throw new Error("Unauthorized");
    }
    return res;
}

async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
    }
    const res = await authedFetch(API + path, opts);
    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const err = await res.json();
            detail = err.detail || detail;
        } catch (_) {}
        throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
}

function render(memos) {
    els.count.textContent = `${memos.length}개`;
    els.empty.hidden = memos.length > 0;
    els.list.innerHTML = memos
        .map(
            (m) => `
        <article class="memo" data-id="${m.id}">
            <div class="memo-head">
                <span class="memo-title">${escapeHtml(m.title)}</span>
                <span class="memo-time" title="${m.updated_at}">${fmtTime(m.updated_at)}</span>
            </div>
            ${m.content ? `<p class="memo-content">${escapeHtml(m.content)}</p>` : ""}
            <div class="memo-actions">
                <button class="btn-edit" data-action="edit">수정</button>
                <button class="btn-danger" data-action="delete">삭제</button>
            </div>
        </article>
    `,
        )
        .join("");
}

async function loadMemos() {
    try {
        const memos = await api("GET", "");
        render(memos);
    } catch (e) {
        if (e.message !== "Unauthorized") {
            toast(`불러오기 실패: ${e.message}`, "error");
        }
    }
}

function enterEditMode(memo) {
    els.id.value = memo.id;
    els.title.value = memo.title;
    els.content.value = memo.content;
    els.formTitle.textContent = `메모 수정 #${memo.id}`;
    els.submitBtn.textContent = "수정";
    els.cancelBtn.hidden = false;
    els.formCard.classList.add("editing");
    els.title.focus();
    els.formCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function exitEditMode() {
    els.id.value = "";
    els.form.reset();
    els.formTitle.textContent = "새 메모";
    els.submitBtn.textContent = "저장";
    els.cancelBtn.hidden = true;
    els.formCard.classList.remove("editing");
}

els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = els.id.value;
    const payload = {
        title: els.title.value.trim(),
        content: els.content.value,
    };
    if (!payload.title) {
        toast("제목을 입력하세요", "error");
        return;
    }
    try {
        if (id) {
            await api("PUT", `/${id}`, payload);
            toast("수정되었습니다", "success");
        } else {
            await api("POST", "", payload);
            toast("저장되었습니다", "success");
        }
        exitEditMode();
        await loadMemos();
    } catch (err) {
        if (err.message !== "Unauthorized") {
            toast(`저장 실패: ${err.message}`, "error");
        }
    }
});

els.cancelBtn.addEventListener("click", exitEditMode);

els.list.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".memo");
    const id = card.dataset.id;
    const action = btn.dataset.action;

    if (action === "edit") {
        try {
            const memo = await api("GET", `/${id}`);
            enterEditMode(memo);
        } catch (err) {
            if (err.message !== "Unauthorized") {
                toast(`메모를 불러올 수 없습니다: ${err.message}`, "error");
            }
        }
    } else if (action === "delete") {
        if (!confirm("이 메모를 삭제할까요?")) return;
        try {
            await api("DELETE", `/${id}`);
            toast("삭제되었습니다", "success");
            if (els.id.value === id) exitEditMode();
            await loadMemos();
        } catch (err) {
            if (err.message !== "Unauthorized") {
                toast(`삭제 실패: ${err.message}`, "error");
            }
        }
    }
});

els.logoutBtn.addEventListener("click", async () => {
    const refresh = localStorage.getItem(STORAGE.refresh);
    if (refresh) {
        try {
            await fetch("/auth/logout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refresh }),
            });
        } catch (_) {
            /* best-effort */
        }
    }
    clearSessionAndRedirect();
});

// Top-bar greeting
const username = localStorage.getItem(STORAGE.username);
if (username) {
    els.userBadge.textContent = `@${username}`;
    els.userBadge.hidden = false;
}
els.logoutBtn.hidden = false;

loadMemos();
