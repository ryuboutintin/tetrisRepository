# Memo App

FastAPI + SQLite로 만든 메모장 CRUD 예제입니다.

## 실행

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

기본 접속 주소는 `http://127.0.0.1:8000` 입니다.

## 서비스 확인

서비스가 정상적으로 올라왔는지 아래 순서로 확인하면 됩니다.

1. 브라우저에서 `http://127.0.0.1:8000/` 접속
2. API 문서 페이지 `http://127.0.0.1:8000/docs` 접속
3. 터미널에서 상태 확인

```bash
curl http://127.0.0.1:8000/
```

HTML 화면이 응답되면 서비스가 정상적으로 실행 중입니다.

## 검증 완료

2026-05-19 기준으로 로컬에서 실제 응답을 확인했습니다.

- `GET /` -> `200 OK`
- `GET /docs` -> `200 OK`

응답 확인 시 `http://127.0.0.1:8000/` 에서 메인 화면 HTML이 내려오고, `http://127.0.0.1:8000/docs` 에서 Swagger UI가 노출됩니다.

## 파일 구조

- `main.py`: FastAPI 서버
- `static/index.html`: 화면 구조
- `static/styles.css`: 스타일
- `static/app.js`: CRUD 로직

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/memos`
- `POST /api/memos`
- `GET /api/memos/{memo_id}`
- `PUT /api/memos/{memo_id}`
- `DELETE /api/memos/{memo_id}`

## 참고

- SQLite DB 파일은 `memo.db` 에 생성됩니다.
- JWT 비밀키를 바꾸려면 `MEMO_JWT_SECRET` 환경 변수를 설정하세요.
