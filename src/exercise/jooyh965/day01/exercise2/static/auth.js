const STORAGE = {
    access: "memo.access_token",
    refresh: "memo.refresh_token",
    username: "memo.username",
};

const toastEl = document.getElementById("toast");
let toastTimer;
function toast(message, type = "") {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.hidden = true;
    }, 2400);
}

// Show one-shot flash message handed off by script.js (e.g. session expired).
const flash = sessionStorage.getItem("memo.flash");
if (flash) {
    sessionStorage.removeItem("memo.flash");
    toast(flash, "error");
}

// If already signed in (and token still valid), skip straight to the app.
(async function bootstrap() {
    const access = localStorage.getItem(STORAGE.access);
    if (!access) return;
    try {
        const res = await fetch("/auth/me", {
            headers: { Authorization: `Bearer ${access}` },
        });
        if (res.ok) {
            window.location.replace("/app");
        }
    } catch (_) {
        /* offline or server down — stay on login page */
    }
})();

const tabs = document.querySelectorAll(".auth-tab");
const forms = {
    login: document.getElementById("loginForm"),
    signup: document.getElementById("signupForm"),
};

tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        Object.entries(forms).forEach(([name, form]) => {
            form.hidden = name !== target;
        });
        const firstInput = forms[target].querySelector("input");
        if (firstInput) firstInput.focus();
    });
});

async function readError(res) {
    try {
        const data = await res.json();
        if (typeof data.detail === "string") return data.detail;
        if (Array.isArray(data.detail)) {
            return data.detail.map((d) => d.msg).join(", ");
        }
        return `HTTP ${res.status}`;
    } catch (_) {
        return `HTTP ${res.status}`;
    }
}

forms.signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(forms.signup);
    const username = fd.get("username").trim();
    const password = fd.get("password");
    const password2 = fd.get("password2");

    if (password !== password2) {
        toast("비밀번호가 일치하지 않습니다", "error");
        return;
    }

    try {
        const res = await fetch("/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            toast(`회원가입 실패: ${await readError(res)}`, "error");
            return;
        }
        toast("회원가입 성공! 자동 로그인합니다.", "success");
        await doLogin(username, password);
    } catch (err) {
        toast(`네트워크 오류: ${err.message}`, "error");
    }
});

forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(forms.login);
    await doLogin(fd.get("username").trim(), fd.get("password"));
});

async function doLogin(username, password) {
    // /auth/login expects OAuth2 form-encoded body (username, password)
    const body = new URLSearchParams({ username, password });
    try {
        const res = await fetch("/auth/login", {
            method: "POST",
            body,
        });
        if (!res.ok) {
            toast(`로그인 실패: ${await readError(res)}`, "error");
            return;
        }
        const data = await res.json();
        localStorage.setItem(STORAGE.access, data.access_token);
        localStorage.setItem(STORAGE.refresh, data.refresh_token);
        localStorage.setItem(STORAGE.username, username);
        window.location.href = "/app";
    } catch (err) {
        toast(`네트워크 오류: ${err.message}`, "error");
    }
}
