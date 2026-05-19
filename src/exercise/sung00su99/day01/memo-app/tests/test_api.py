import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
TEST_USER = {"email": "memo@test.com", "username": "memouser", "password": "pass1234"}


@pytest.fixture
async def client():
    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def auth_client(client: AsyncClient):
    """회원가입 + 로그인이 완료된 인증 클라이언트."""
    await client.post("/api/v1/auth/register", json=TEST_USER)
    res = await client.post(
        "/api/v1/auth/token",
        data={"username": TEST_USER["username"], "password": TEST_USER["password"]},
    )
    token = res.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client


# ── 생성 ──────────────────────────────────────────────────────────────────────

async def test_create_memo(auth_client: AsyncClient):
    res = await auth_client.post("/api/v1/memos/", json={"title": "Hello", "content": "World"})
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Hello"
    assert data["content"] == "World"
    assert data["is_pinned"] is False
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["tags"] == []
    assert data["category"] is None


# ── 목록 ──────────────────────────────────────────────────────────────────────

async def test_list_memos(auth_client: AsyncClient):
    await auth_client.post("/api/v1/memos/", json={"title": "A", "content": "aaa"})
    await auth_client.post("/api/v1/memos/", json={"title": "B", "content": "bbb"})

    res = await auth_client.get("/api/v1/memos/")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert len(res.json()) == 2


async def test_list_memos_search(auth_client: AsyncClient):
    await auth_client.post("/api/v1/memos/", json={"title": "Python", "content": "great language"})
    await auth_client.post("/api/v1/memos/", json={"title": "Java", "content": "verbose"})

    res = await auth_client.get("/api/v1/memos/?q=python")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["title"] == "Python"


# ── 단건 조회 ─────────────────────────────────────────────────────────────────

async def test_get_memo(auth_client: AsyncClient):
    created = (await auth_client.post("/api/v1/memos/", json={"title": "T", "content": "C"})).json()
    res = await auth_client.get(f"/api/v1/memos/{created['id']}")
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


async def test_get_memo_not_found(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/memos/9999")
    assert res.status_code == 404


# ── 수정 ──────────────────────────────────────────────────────────────────────

async def test_update_memo(auth_client: AsyncClient):
    created = (await auth_client.post("/api/v1/memos/", json={"title": "Old", "content": "Old content"})).json()

    res = await auth_client.put(
        f"/api/v1/memos/{created['id']}",
        json={"title": "New", "content": "New content"},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "New"
    assert res.json()["content"] == "New content"


# ── 핀 토글 ───────────────────────────────────────────────────────────────────

async def test_pin_toggle(auth_client: AsyncClient):
    created = (await auth_client.post("/api/v1/memos/", json={"title": "P", "content": "pin test"})).json()
    assert created["is_pinned"] is False

    toggled = (await auth_client.patch(f"/api/v1/memos/{created['id']}/pin")).json()
    assert toggled["is_pinned"] is True

    toggled_back = (await auth_client.patch(f"/api/v1/memos/{created['id']}/pin")).json()
    assert toggled_back["is_pinned"] is False


# ── 삭제 ──────────────────────────────────────────────────────────────────────

async def test_delete_memo(auth_client: AsyncClient):
    created = (await auth_client.post("/api/v1/memos/", json={"title": "Del", "content": "bye"})).json()

    res = await auth_client.delete(f"/api/v1/memos/{created['id']}")
    assert res.status_code == 204

    res = await auth_client.get(f"/api/v1/memos/{created['id']}")
    assert res.status_code == 404
