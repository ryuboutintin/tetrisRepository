# FastAPI Memo CRUD

SQLite를 사용하는 간단한 메모장입니다. JWT 인증을 사용하며, 로그인한 사용자별로 메모 생성, 조회, 수정, 삭제를 할 수 있습니다.

## 실행

가장 간단한 실행 방법입니다.

```bash
./start.sh
```

`pip` 또는 `venv`가 없다는 오류가 나오면 먼저 아래를 실행하세요.

```bash
sudo apt update
sudo apt install python3-pip python3.10-venv
```

직접 실행하려면 아래 순서대로 실행하면 됩니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

로컬 PC에서는 브라우저에서 `http://127.0.0.1:8000`을 열면 됩니다.
원격 개발 환경이나 컨테이너에서는 IDE가 안내하는 8000번 포트의 forwarded URL을 열어야 합니다.

## 환경 변수

개발용 기본 JWT 비밀키가 들어있습니다. 실제 배포에서는 반드시 직접 설정하세요.

```bash
export JWT_SECRET_KEY="원하는-긴-랜덤-문자열"
```

## API

- `POST /api/register`: 회원가입 및 JWT 발급
- `POST /api/login`: 로그인 및 JWT 발급
- `GET /api/memos`: 내 메모 목록
- `POST /api/memos`: 내 메모 생성
- `GET /api/memos/{memo_id}`: 내 메모 상세
- `PUT /api/memos/{memo_id}`: 내 메모 수정
- `DELETE /api/memos/{memo_id}`: 내 메모 삭제

API에서 메모 엔드포인트를 호출할 때는 아래처럼 JWT를 전달합니다.

```bash
curl -X POST http://127.0.0.1:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"secret123"}'

curl http://127.0.0.1:8000/api/memos \
  -H "Authorization: Bearer 발급받은_JWT"
```
