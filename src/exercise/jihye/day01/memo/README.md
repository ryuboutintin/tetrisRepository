# Memo App

FastAPI + SQLite로 만든 메모장 CRUD 예제입니다. JWT 인증, 태그, 카테고리, Todo 기능을 포함합니다.

UI는 다음처럼 분리되어 있습니다.

- `static/index.html`: 화면 구조
- `static/styles.css`: 스타일
- `static/app.js`: CRUD 로직과 다크모드 토글

## Run

```bash
cd memo
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

브라우저에서 `http://127.0.0.1:8000` 을 열면 UI가 표시됩니다.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/memos`
- `POST /api/memos`
- `GET /api/memos/{memo_id}`
- `PUT /api/memos/{memo_id}`
- `DELETE /api/memos/{memo_id}`

메모 payload 예시:

```json
{
  "title": "할 일",
  "content": "FastAPI 정리",
  "category": "공부",
  "tags": ["fastapi", "sqlite"],
  "kind": "todo",
  "is_done": false
}
```

SQLite DB 파일은 `memo/memo.db` 에 생성됩니다. JWT 비밀키를 바꾸려면 `MEMO_JWT_SECRET` 환경 변수를 설정하세요.
