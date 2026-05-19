import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
USER = {"email": "tag@test.com", "username": "taguser", "password": "pass1234"}


@pytest.fixture
async def auth_client():
    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/v1/auth/register", json=USER)
        res = await c.post(
            "/api/v1/auth/token",
            data={"username": USER["username"], "password": USER["password"]},
        )
        c.headers["Authorization"] = f"Bearer {res.json()['access_token']}"
        yield c

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ── 카테고리 CRUD ─────────────────────────────────────────────────────────────

async def test_create_category(auth_client: AsyncClient):
    res = await auth_client.post("/api/v1/categories/", json={"name": "업무", "color": "#ef4444"})
    assert res.status_code == 201
    assert res.json()["name"] == "업무"
    assert res.json()["color"] == "#ef4444"


async def test_list_categories(auth_client: AsyncClient):
    await auth_client.post("/api/v1/categories/", json={"name": "A"})
    await auth_client.post("/api/v1/categories/", json={"name": "B"})
    res = await auth_client.get("/api/v1/categories/")
    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_update_category(auth_client: AsyncClient):
    cat = (await auth_client.post("/api/v1/categories/", json={"name": "Old"})).json()
    res = await auth_client.put(f"/api/v1/categories/{cat['id']}", json={"name": "New", "color": "#000000"})
    assert res.status_code == 200
    assert res.json()["name"] == "New"


async def test_delete_category(auth_client: AsyncClient):
    cat = (await auth_client.post("/api/v1/categories/", json={"name": "ToDelete"})).json()
    res = await auth_client.delete(f"/api/v1/categories/{cat['id']}")
    assert res.status_code == 204
    cats = (await auth_client.get("/api/v1/categories/")).json()
    assert all(c["id"] != cat["id"] for c in cats)


# ── 태그 CRUD ─────────────────────────────────────────────────────────────────

async def test_create_tag(auth_client: AsyncClient):
    res = await auth_client.post("/api/v1/tags/", json={"name": "python"})
    assert res.status_code == 201
    assert res.json()["name"] == "python"
    assert res.json()["memo_count"] == 0


async def test_tag_memo_link(auth_client: AsyncClient):
    tag = (await auth_client.post("/api/v1/tags/", json={"name": "fastapi"})).json()

    memo = (await auth_client.post(
        "/api/v1/memos/",
        json={"title": "FastAPI Memo", "content": "hello", "tag_ids": [tag["id"]]},
    )).json()

    assert len(memo["tags"]) == 1
    assert memo["tags"][0]["name"] == "fastapi"


async def test_tag_filter(auth_client: AsyncClient):
    t1 = (await auth_client.post("/api/v1/tags/", json={"name": "tag1"})).json()
    t2 = (await auth_client.post("/api/v1/tags/", json={"name": "tag2"})).json()

    await auth_client.post("/api/v1/memos/", json={"title": "Both",   "content": "x", "tag_ids": [t1["id"], t2["id"]]})
    await auth_client.post("/api/v1/memos/", json={"title": "Only t1","content": "x", "tag_ids": [t1["id"]]})
    await auth_client.post("/api/v1/memos/", json={"title": "No tags","content": "x"})

    # tag1만 필터 → 2개
    res = await auth_client.get(f"/api/v1/memos/?tag_ids={t1['id']}")
    assert res.status_code == 200
    assert len(res.json()) == 2

    # tag1 AND tag2 → 1개
    res = await auth_client.get(f"/api/v1/memos/?tag_ids={t1['id']}&tag_ids={t2['id']}")
    assert len(res.json()) == 1
    assert res.json()[0]["title"] == "Both"


async def test_delete_tag_removes_from_memo(auth_client: AsyncClient):
    tag = (await auth_client.post("/api/v1/tags/", json={"name": "temp"})).json()
    memo = (await auth_client.post(
        "/api/v1/memos/",
        json={"title": "M", "content": "c", "tag_ids": [tag["id"]]},
    )).json()
    assert len(memo["tags"]) == 1

    await auth_client.delete(f"/api/v1/tags/{tag['id']}")

    # 태그 삭제 후 메모 재조회 → 태그 목록에서 제거됨
    updated = (await auth_client.get(f"/api/v1/memos/{memo['id']}")).json()
    assert updated["tags"] == []
