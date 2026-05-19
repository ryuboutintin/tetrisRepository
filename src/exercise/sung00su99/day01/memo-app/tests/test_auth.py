import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
USER_A = {"email": "a@test.com", "username": "userA", "password": "pass1234"}
USER_B = {"email": "b@test.com", "username": "userB", "password": "pass5678"}


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


async def _register_login(client: AsyncClient, user: dict) -> str:
    await client.post("/api/v1/auth/register", json=user)
    res = await client.post(
        "/api/v1/auth/token",
        data={"username": user["username"], "password": user["password"]},
    )
    return res.json()["access_token"]


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── 회원가입 ──────────────────────────────────────────────────────────────────

async def test_register(client: AsyncClient):
    res = await client.post("/api/v1/auth/register", json=USER_A)
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == USER_A["email"]
    assert data["username"] == USER_A["username"]
    assert "id" in data


async def test_register_duplicate(client: AsyncClient):
    await client.post("/api/v1/auth/register", json=USER_A)
    res = await client.post("/api/v1/auth/register", json=USER_A)
    assert res.status_code == 400


# ── 로그인 ────────────────────────────────────────────────────────────────────

async def test_login(client: AsyncClient):
    await client.post("/api/v1/auth/register", json=USER_A)
    res = await client.post(
        "/api/v1/auth/token",
        data={"username": USER_A["username"], "password": USER_A["password"]},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json=USER_A)
    res = await client.post(
        "/api/v1/auth/token",
        data={"username": USER_A["username"], "password": "wrongpass"},
    )
    assert res.status_code == 401


# ── 토큰 없이 API 접근 ────────────────────────────────────────────────────────

async def test_memo_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/memos/")
    assert res.status_code == 401


# ── /me ───────────────────────────────────────────────────────────────────────

async def test_me(client: AsyncClient):
    token = await _register_login(client, USER_A)
    res = await client.get("/api/v1/auth/me", headers=_bearer(token))
    assert res.status_code == 200
    assert res.json()["username"] == USER_A["username"]


# ── refresh ───────────────────────────────────────────────────────────────────

async def test_refresh_token(client: AsyncClient):
    await client.post("/api/v1/auth/register", json=USER_A)
    login_res = await client.post(
        "/api/v1/auth/token",
        data={"username": USER_A["username"], "password": USER_A["password"]},
    )
    refresh_token = login_res.json()["refresh_token"]

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert res.status_code == 200
    assert "access_token" in res.json()


# ── 타인 메모 접근 → 403 ────────────────────────────────────────────────────

async def test_other_user_memo_forbidden(client: AsyncClient):
    token_a = await _register_login(client, USER_A)
    token_b = await _register_login(client, USER_B)

    # A가 메모 생성
    memo_res = await client.post(
        "/api/v1/memos/",
        json={"title": "A's memo", "content": "private"},
        headers=_bearer(token_a),
    )
    memo_id = memo_res.json()["id"]

    # B가 A의 메모 조회 → 403
    res = await client.get(f"/api/v1/memos/{memo_id}", headers=_bearer(token_b))
    assert res.status_code == 403
