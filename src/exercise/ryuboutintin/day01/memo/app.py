from __future__ import annotations

import sqlite3
from collections.abc import AsyncIterator
from contextlib import closing
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_PATH = BASE_DIR / "memo.db"


class MemoCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "팀 회의 메모",
                "content": "1. API 설계 검토\n2. 배포 일정 공유",
            }
        }
    )

    title: str = Field(
        min_length=1,
        max_length=100,
        examples=["팀 회의 메모"],
    )
    content: str = Field(
        default="",
        max_length=5000,
        examples=["1. API 설계 검토\n2. 배포 일정 공유"],
    )


class MemoUpdate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "수정된 회의 메모",
                "content": "1. Swagger 테스트 완료\n2. UI 연결 확인 필요",
            }
        }
    )

    title: str = Field(
        min_length=1,
        max_length=100,
        examples=["수정된 회의 메모"],
    )
    content: str = Field(
        default="",
        max_length=5000,
        examples=["1. Swagger 테스트 완료\n2. UI 연결 확인 필요"],
    )


class Memo(MemoCreate):
    id: int
    created_at: str
    updated_at: str


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with closing(get_connection()) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS memos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(
    title="Memo CRUD API",
    description=(
        "간단한 메모 CRUD API입니다. `/docs`의 Swagger UI에서 "
        "생성, 조회, 수정, 삭제 요청을 직접 실행할 수 있습니다."
    ),
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "memos",
            "description": "메모 생성, 조회, 수정, 삭제 API",
        }
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get(
    "/api/memos",
    response_model=list[Memo],
    tags=["memos"],
    summary="메모 목록 조회",
    description="최근 수정된 메모부터 내림차순으로 반환합니다.",
)
def list_memos() -> list[Memo]:
    with closing(get_connection()) as connection:
        rows = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            ORDER BY updated_at DESC, id DESC
            """
        ).fetchall()
    return [Memo(**dict(row)) for row in rows]


@app.get(
    "/api/memos/{memo_id}",
    response_model=Memo,
    tags=["memos"],
    summary="메모 단건 조회",
    description="메모 ID로 특정 메모를 조회합니다.",
)
def get_memo(memo_id: int) -> Memo:
    with closing(get_connection()) as connection:
        row = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (memo_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Memo not found")
    return Memo(**dict(row))


@app.post(
    "/api/memos",
    response_model=Memo,
    status_code=201,
    tags=["memos"],
    summary="메모 생성",
    description="제목과 내용을 받아 새 메모를 생성합니다.",
)
def create_memo(payload: MemoCreate) -> Memo:
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO memos (title, content)
            VALUES (?, ?)
            """,
            (payload.title.strip(), payload.content.strip()),
        )
        connection.commit()
        memo_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (memo_id,),
        ).fetchone()
    return Memo(**dict(row))


@app.put(
    "/api/memos/{memo_id}",
    response_model=Memo,
    tags=["memos"],
    summary="메모 수정",
    description="기존 메모의 제목과 내용을 수정합니다.",
)
def update_memo(memo_id: int, payload: MemoUpdate) -> Memo:
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            """
            UPDATE memos
            SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (payload.title.strip(), payload.content.strip(), memo_id),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Memo not found")
        row = connection.execute(
            """
            SELECT id, title, content, created_at, updated_at
            FROM memos
            WHERE id = ?
            """,
            (memo_id,),
        ).fetchone()
    return Memo(**dict(row))


@app.delete(
    "/api/memos/{memo_id}",
    status_code=204,
    tags=["memos"],
    summary="메모 삭제",
    description="메모 ID로 특정 메모를 삭제합니다.",
)
def delete_memo(memo_id: int) -> None:
    with closing(get_connection()) as connection:
        cursor = connection.execute(
            "DELETE FROM memos WHERE id = ?",
            (memo_id,),
        )
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Memo not found")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
