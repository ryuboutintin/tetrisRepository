# memo-api 배포 가이드

## 1. 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│                                                             │
│   static/index.html  ──  static/app.js  ──  static/style.css│
│        (UI 구조)           (fetch + JWT)       (다크 테마)   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/JSON
                             │ Authorization: Bearer <token>
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               FastAPI 애플리케이션 (main.py)                 │
│                                                             │
│  [인증 불필요]                                               │
│  POST /auth/register   회원가입 (bcrypt 해싱)                │
│  POST /auth/login      로그인 → JWT 발급                     │
│                                                             │
│  [JWT 인증 필요]                                             │
│  GET  /categories          카테고리 목록                     │
│  POST /categories          카테고리 생성                     │
│  DELETE /categories/{id}   카테고리 삭제                     │
│                                                             │
│  GET  /tags                태그 목록                         │
│                                                             │
│  GET  /memos               메모 목록 (카테고리·태그 필터)    │
│  GET  /memos/{id}          메모 단건 조회                    │
│  POST /memos               메모 생성                         │
│  PUT  /memos/{id}          메모 수정                         │
│  DELETE /memos/{id}        메모 삭제                         │
│                                                             │
│  GET  /static/*            정적 파일 서빙                    │
│  GET  /docs                Swagger UI                       │
└────────────────────────────┬────────────────────────────────┘
                             │ Python 내장 sqlite3
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    memos.db (SQLite)                        │
│                                                             │
│  users       id, username, hashed_password, created_at      │
│  categories  id, user_id, name, created_at                  │
│  memos       id, user_id, category_id, title, content,      │
│              created_at, updated_at                         │
│  tags        id, user_id, name, created_at                  │
│  memo_tags   memo_id, tag_id  (N:M 중간 테이블)             │
└─────────────────────────────────────────────────────────────┘
```

### 파일 구조

```
memo-api/
├── main.py           FastAPI 앱 (인증·라우터·스키마·DB 단일 파일)
├── memos.db          SQLite DB (최초 실행 시 자동 생성, git 제외)
├── pyproject.toml    uv 의존성 정의
├── uv.lock           잠금 파일
├── .python-version   Python 3.10 고정
├── .gitignore
├── CLAUDE.md
├── DEPLOY.md         (이 파일)
└── static/
    ├── index.html    로그인·회원가입·메모 앱 UI
    ├── app.js        JWT 저장·전송·CRUD·카테고리·태그 로직
    └── style.css     다크 테마 CSS 변수 기반 스타일
```

---

## 2. 구동 환경

| 항목 | 버전 |
|------|------|
| Python | 3.10 이상 |
| FastAPI | 0.136.1 |
| Uvicorn | 0.47.0 |
| Pydantic | 2.x |
| python-jose | 3.5.0 이상 |
| bcrypt | 5.0.0 이상 |
| 패키지 관리 | [uv](https://docs.astral.sh/uv/) |
| DB | SQLite (Python 내장, 별도 설치 불필요) |

---

## 3. 로컬 개발 실행

### 사전 요구 사항

```bash
# uv 설치 (미설치 시)
curl -Ls https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
```

### 의존성 설치 및 서버 시작

```bash
cd src/exercise/khi808/day01/memo-api

# 가상환경 생성 + 의존성 설치 (최초 1회)
uv sync

# 서버 시작 (hot-reload 포함)
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

| URL | 설명 |
|-----|------|
| http://localhost:8000 | 웹 UI |
| http://localhost:8000/docs | Swagger API 문서 |

### 서버 종료

```bash
kill $(lsof -ti:8000)
```

### hot-reload 없이 가볍게 실행

```bash
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 4. 프로덕션 배포

### 4-1. 환경 변수 설정

`main.py` 상단의 `SECRET_KEY`를 환경 변수로 교체합니다.

```python
import os
SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-in-production")
```

```bash
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
```

### 4-2. Nginx 리버스 프록시 (권장)

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 4-3. systemd 서비스 등록

```ini
# /etc/systemd/system/memo-api.service
[Unit]
Description=memo-api FastAPI service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/work/kosa-vibecoding-2026-2nd/src/exercise/khi808/day01/memo-api
Environment="SECRET_KEY=your-secret-here"
ExecStart=/home/ubuntu/.local/bin/uv run python -m uvicorn main:app --host 127.0.0.1 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable memo-api
sudo systemctl start memo-api
sudo systemctl status memo-api
```

### 4-4. Docker 배포

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-dev

COPY main.py ./
COPY static/ ./static/

ENV SECRET_KEY=change-this-secret
EXPOSE 8000

CMD ["uv", "run", "python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# 이미지 빌드 및 실행
docker build -t memo-api .
docker run -d \
  -p 8000:8000 \
  -e SECRET_KEY="your-secret-here" \
  -v $(pwd)/data:/app/data \
  --name memo-api \
  memo-api
```

> **주의**: DB 파일(`memos.db`)을 컨테이너 외부에 마운트하지 않으면 컨테이너 재시작 시 데이터가 초기화됩니다.  
> `DB_PATH`를 `/app/data/memos.db`로 변경하고 볼륨을 마운트하세요.

---

## 5. DB 마이그레이션

`init_db()`가 서버 시작 시 자동으로 실행되며, 누락된 컬럼을 `ALTER TABLE`로 추가합니다. 수동 작업은 불필요합니다.

기존 DB를 직접 확인하려면:

```bash
sqlite3 memos.db ".tables"
sqlite3 memos.db ".schema memos"
```

---

## 6. 인증 흐름 요약

```
회원가입  POST /auth/register  →  bcrypt.hashpw()  →  users 테이블 저장
로그인    POST /auth/login     →  비밀번호 검증    →  JWT 발급 (60분 만료)
API 요청  Authorization: Bearer <token>
          → jose.jwt.decode()  →  sub(user_id) 추출
          → 모든 쿼리에 WHERE user_id = ? 적용 (사용자 격리)
```

---

## 7. 주요 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| JWT 라이브러리 | `python-jose` + HS256 | 경량, Python 표준 JWT 구현 |
| 비밀번호 해싱 | `bcrypt` 직접 사용 | `passlib` 호환 이슈 회피 |
| ORM | 없음 (sqlite3 직접) | 의존성 최소화, 단순 CRUD에 충분 |
| 정적 파일 | FastAPI `StaticFiles` | 별도 서버 없이 단일 프로세스 운영 |
| 태그 관계 | N:M (memo_tags 중간 테이블) | 메모 1개에 여러 태그, 태그 재사용 |
| 토큰 저장 | 프론트엔드 localStorage | 새로고침 후에도 로그인 유지 |
