# Memo App

FastAPI + SQLite로 만든 메모장 CRUD 예제입니다.

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

- `GET /api/memos`
- `POST /api/memos`
- `GET /api/memos/{memo_id}`
- `PUT /api/memos/{memo_id}`
- `DELETE /api/memos/{memo_id}`

SQLite DB 파일은 `memo/memo.db` 에 생성됩니다.
