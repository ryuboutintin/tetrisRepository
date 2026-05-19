const authSection = document.getElementById("auth-section");
const workspace = document.getElementById("workspace");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authStatusText = document.getElementById("auth-status-text");
const currentUsername = document.getElementById("current-username");
const logoutButton = document.getElementById("logout-button");

const form = document.getElementById("memo-form");
const formTitle = document.getElementById("form-title");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const tagsInput = document.getElementById("tags");
const contentInput = document.getElementById("content");
const submitButton = document.getElementById("submit-button");
const resetButton = document.getElementById("reset-button");
const refreshButton = document.getElementById("refresh-button");
const statusText = document.getElementById("status-text");
const memoList = document.getElementById("memo-list");
const emptyState = document.getElementById("empty-state");
const filterCategoryInput = document.getElementById("filter-category");
const filterTagInput = document.getElementById("filter-tag");
const clearFiltersButton = document.getElementById("clear-filters-button");

const ACCESS_TOKEN_KEY = "memo_access_token";
const REFRESH_TOKEN_KEY = "memo_refresh_token";
const USER_KEY = "memo_user";

let editingMemoId = null;
let authToken = localStorage.getItem(ACCESS_TOKEN_KEY);
let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
let currentUser = readStoredUser();
let refreshPromise = null;

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

async function request(url, options = {}, retryOnAuthFailure = true) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && retryOnAuthFailure && refreshToken && url !== "/api/auth/refresh") {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request(url, options, false);
      }
    }
    if (response.status === 401) {
      clearSession();
      syncAuthView();
    }
    throw new Error(data.detail || "요청 처리 중 오류가 발생했습니다.");
  }
  return data;
}

async function refreshAccessToken() {
  if (!refreshToken) {
    return false;
  }
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        clearSession();
        syncAuthView();
        return false;
      }

      const data = await response.json();
      authToken = data.access_token;
      refreshToken = data.refresh_token;
      localStorage.setItem(ACCESS_TOKEN_KEY, authToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      return true;
    } catch {
      clearSession();
      syncAuthView();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function setStatus(message) {
  statusText.textContent = message;
}

function setAuthStatus(message) {
  authStatusText.textContent = message;
}

function clearSession() {
  authToken = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function saveSession(payload) {
  authToken = payload.access_token;
  refreshToken = payload.refresh_token;
  currentUser = payload.user;
  localStorage.setItem(ACCESS_TOKEN_KEY, authToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
}

function syncAuthView() {
  const authenticated = Boolean(authToken && refreshToken && currentUser);
  authSection.hidden = authenticated;
  workspace.hidden = !authenticated;
  currentUsername.textContent = authenticated ? `${currentUser.username} 님` : "-";
  if (!authenticated) {
    memoList.innerHTML = "";
    emptyState.hidden = false;
    setStatus("로그인 후 메모를 확인할 수 있습니다.");
    setAuthStatus("로그인 필요");
  }
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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
  categoryInput.value = memo.category || "";
  tagsInput.value = (memo.tags || []).join(", ");
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

    const header = document.createElement("div");
    header.className = "memo-header";

    const title = document.createElement("h3");
    title.textContent = memo.title;

    const category = document.createElement("span");
    category.className = "category-pill";
    category.textContent = memo.category || "미분류";
    header.append(title, category);

    const tagList = document.createElement("div");
    tagList.className = "tag-list";
    if (memo.tags?.length) {
      for (const tag of memo.tags) {
        const tagItem = document.createElement("span");
        tagItem.className = "tag-pill";
        tagItem.textContent = `#${tag}`;
        tagList.append(tagItem);
      }
    }

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
    editButton.addEventListener("click", () => startEdit(memo));

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
    item.append(header, tagList, content, meta, controls);
    memoList.appendChild(item);
  }
}

async function loadMemos() {
  if (!authToken) {
    return;
  }

  try {
    const params = new URLSearchParams();
    const category = filterCategoryInput.value.trim();
    const tag = filterTagInput.value.trim();
    if (category) {
      params.set("category", category);
    }
    if (tag) {
      params.set("tag", tag);
    }

    const query = params.toString();
    const memos = await request(`/api/memos${query ? `?${query}` : ""}`);
    renderMemos(memos);
    setStatus(memos.length ? "메모를 불러왔습니다." : "조건에 맞는 메모가 없습니다.");
  } catch (error) {
    setStatus(error.message);
  }
}

async function handleAuthSubmit(event, endpoint) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || "").trim(),
  };

  if (!payload.username || !payload.password) {
    setAuthStatus("사용자 이름과 비밀번호를 입력하세요.");
    return;
  }

  try {
    const data = await request(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveSession(data);
    syncAuthView();
    resetForm();
    setAuthStatus(`${data.user.username} 계정으로 로그인되었습니다.`);
    setStatus("로그인 완료");
    await loadMemos();
  } catch (error) {
    setAuthStatus(error.message);
  }
}

loginForm.addEventListener("submit", (event) => handleAuthSubmit(event, "/api/auth/login"));
registerForm.addEventListener("submit", (event) => handleAuthSubmit(event, "/api/auth/register"));

logoutButton.addEventListener("click", async () => {
  try {
    if (refreshToken) {
      await request(
        "/api/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
        false,
      );
    }
  } catch {
    // Ignore logout failures and clear local session regardless.
  } finally {
    clearSession();
    resetForm();
    syncAuthView();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    title: titleInput.value.trim(),
    category: categoryInput.value.trim(),
    tags: parseTags(tagsInput.value),
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
clearFiltersButton.addEventListener("click", async () => {
  filterCategoryInput.value = "";
  filterTagInput.value = "";
  await loadMemos();
});
filterCategoryInput.addEventListener("change", loadMemos);
filterTagInput.addEventListener("change", loadMemos);

async function bootstrap() {
  syncAuthView();
  if (!authToken || !refreshToken) {
    return;
  }

  try {
    const user = await request("/api/auth/me");
    currentUser = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    syncAuthView();
    await loadMemos();
  } catch {
    clearSession();
    syncAuthView();
  }
}

bootstrap();
