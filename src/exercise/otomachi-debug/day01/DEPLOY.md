# DEPLOY.md

> KOSA 바이브코딩 2026 2기 — otomachi-debug  
> day01 실습 프로젝트 배포 가이드

---

## 목차

1. [프로젝트별 배포 대상 분류](#1-프로젝트별-배포-대상-분류)
2. [로컬 실행 (개발)](#2-로컬-실행-개발)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [정적 사이트 배포 — GitHub Pages](#4-정적-사이트-배포--github-pages)
5. [FastAPI 배포 — Render (무료)](#5-fastapi-배포--render-무료)
6. [FastAPI 배포 — Railway (무료)](#6-fastapi-배포--railway-무료)
7. [Docker로 로컬 컨테이너 실행](#7-docker로-로컬-컨테이너-실행)
8. [프로덕션 체크리스트](#8-프로덕션-체크리스트)

---

## 1. 프로젝트별 배포 대상 분류

| 프로젝트 | 유형 | 권장 배포처 |
|----------|------|------------|
| `personal_landing/` | 정적 HTML | GitHub Pages / Netlify |
| `markdown-editor/` | 정적 HTML/CSS/JS | GitHub Pages / Netlify |
| `memo-app/` | FastAPI + SQLite | Render / Railway |
| `jwt-auth/` | FastAPI + SQLite | Render / Railway |

---

## 2. 로컬 실행 (개발)

### 정적 사이트

```bash
# 브라우저에서 직접 열기
open day01/personal_landing/index.html

# 마크다운 에디터 — 로컬 서버 권장 (CSS/JS 분리 파일)
python3 -m http.server 8080 --directory day01/markdown-editor
# → http://localhost:8080
```

### memo-app

```bash
cd day01/memo-app
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
```

### jwt-auth

```bash
cd day01/jwt-auth
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
# → http://localhost:8001/docs  (Swagger UI)
```

---

## 3. 환경 변수 설정

현재 코드에 시크릿 키가 하드코딩되어 있습니다. **실서비스 배포 전 반드시 환경 변수로 분리**해야 합니다.

### 필요한 환경 변수

#### memo-app

| 변수명 | 기본값 (코드) | 설명 |
|--------|--------------|------|
| `SECRET_KEY` | `change-this-secret-in-production` | JWT 서명 키 |
| `DATABASE_URL` | `sqlite:///./memos.db` | DB 연결 문자열 |

#### jwt-auth

| 변수명 | 기본값 (코드) | 설명 |
|--------|--------------|------|
| `ACCESS_SECRET` | `access-secret-key-change-in-production` | Access token 서명 키 |
| `REFRESH_SECRET` | `refresh-secret-key-change-in-production` | Refresh token 서명 키 |
| `DATABASE_URL` | `sqlite:///./auth.db` | DB 연결 문자열 |

### 안전한 시크릿 키 생성

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 코드 수정 예시 (memo-app/auth.py)

```python
import os

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-in-production")
```

### .env 파일 (로컬 개발용)

```bash
# day01/memo-app/.env
SECRET_KEY=여기에_실제_시크릿_키_입력
DATABASE_URL=sqlite:///./memos.db
```

```bash
# day01/jwt-auth/.env
ACCESS_SECRET=여기에_access_시크릿_키_입력
REFRESH_SECRET=여기에_refresh_시크릿_키_입력
DATABASE_URL=sqlite:///./auth.db
```

> `.env` 파일은 절대 git에 커밋하지 않습니다. `.gitignore`에 추가하세요.

---

## 4. 정적 사이트 배포 — GitHub Pages

`personal_landing`과 `markdown-editor`는 서버 불필요 — GitHub Pages로 즉시 배포 가능합니다.

### 방법 A: 저장소 Pages 설정 (가장 간단)

1. GitHub 저장소 → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / Folder: `/ (root)`
4. 저장 후 URL 생성 대기 (~1분)

접속 URL 예시:
```
https://weable-kosa.github.io/kosa-vibecoding-2026-2nd/src/exercise/otomachi-debug/day01/personal_landing/
https://weable-kosa.github.io/kosa-vibecoding-2026-2nd/src/exercise/otomachi-debug/day01/markdown-editor/
```

### 방법 B: Netlify Drop (더 빠른 확인)

1. [netlify.com/drop](https://app.netlify.com/drop) 접속
2. `markdown-editor/` 폴더를 드래그 앤 드롭
3. 즉시 공개 URL 생성

---

## 5. FastAPI 배포 — Render (무료)

Render는 무료 플랜에서 FastAPI를 Web Service로 배포할 수 있습니다.

### 사전 준비

각 FastAPI 앱 디렉터리에 `render.yaml` 또는 Start Command를 설정합니다.

**memo-app Start Command:**
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**jwt-auth Start Command:**
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 배포 절차

1. [render.com](https://render.com) 회원가입 (GitHub 연동)
2. **New** → **Web Service**
3. 저장소 연결: `weable-kosa/kosa-vibecoding-2026-2nd`
4. 설정:
   - **Root Directory**: `src/exercise/otomachi-debug/day01/memo-app`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables** 탭에서 시크릿 키 등록
6. **Create Web Service** 클릭

### 주의사항 (SQLite on Render 무료 플랜)

Render 무료 플랜은 **Ephemeral Storage** — 재배포 시 SQLite `.db` 파일이 초기화됩니다.

- **학습/데모 목적**: 이대로 사용 가능
- **데이터 영구 보존 필요 시**: Render PostgreSQL 추가 또는 [Supabase](https://supabase.com) 연동

---

## 6. FastAPI 배포 — Railway (무료)

Railway는 GitHub Push → 자동 재배포를 지원합니다.

### 배포 절차

1. [railway.app](https://railway.app) 회원가입 (GitHub 연동)
2. **New Project** → **Deploy from GitHub repo**
3. 저장소 선택 후 **Configure** 클릭
4. **Root Directory** 설정:
   - memo-app: `src/exercise/otomachi-debug/day01/memo-app`
   - jwt-auth: `src/exercise/otomachi-debug/day01/jwt-auth`
5. **Variables** 탭에서 환경 변수 등록
6. Start Command 자동 감지 안 될 경우:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

---

## 7. Docker로 로컬 컨테이너 실행

### Dockerfile (memo-app 또는 jwt-auth 공용)

각 앱 디렉터리에 아래 `Dockerfile`을 생성합니다.

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 빌드 및 실행

```bash
# memo-app
cd day01/memo-app
docker build -t memo-app .
docker run -p 8000:8000 \
  -e SECRET_KEY=your-secret-key \
  memo-app

# jwt-auth
cd day01/jwt-auth
docker build -t jwt-auth .
docker run -p 8001:8000 \
  -e ACCESS_SECRET=your-access-secret \
  -e REFRESH_SECRET=your-refresh-secret \
  jwt-auth
```

### docker-compose (두 서비스 동시 실행)

프로젝트 루트(`day01/`)에 `docker-compose.yml` 생성:

```yaml
services:
  memo-app:
    build: ./memo-app
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - memo-db:/app/data

  jwt-auth:
    build: ./jwt-auth
    ports:
      - "8001:8000"
    environment:
      - ACCESS_SECRET=${ACCESS_SECRET}
      - REFRESH_SECRET=${REFRESH_SECRET}
    volumes:
      - jwt-db:/app/data

volumes:
  memo-db:
  jwt-db:
```

```bash
# 실행
cd day01
docker compose up
```

---

## 8. 프로덕션 체크리스트

배포 전 아래 항목을 반드시 확인합니다.

### 보안

- [ ] `SECRET_KEY`, `ACCESS_SECRET`, `REFRESH_SECRET`을 환경 변수로 분리 (`os.getenv`)
- [ ] 시크릿 키는 `secrets.token_hex(32)` 이상의 길이로 생성
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] `auth.db`, `memos.db`가 `.gitignore`에 포함되어 있는지 확인

### CORS 설정 (백엔드)

프론트엔드 도메인이 다를 경우 `main.py`에 CORS 미들웨어를 추가합니다:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] `allow_origins=["*"]` 대신 실제 프론트엔드 URL을 명시

### 데이터베이스

- [ ] 프로덕션에서 SQLite 파일 경로가 영구 스토리지를 가리키는지 확인
- [ ] 필요 시 PostgreSQL 마이그레이션 고려

### 앱 설정

- [ ] `uvicorn` 실행 시 `--host 0.0.0.0` 포함 (컨테이너/PaaS 필수)
- [ ] `--reload` 플래그 제거 (개발 전용)
- [ ] Swagger UI 비활성화 검토: `FastAPI(docs_url=None, redoc_url=None)`
