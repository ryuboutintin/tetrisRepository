# 📝 메모앱 배포 가이드

> Ubuntu 22.04 LTS (바닐라) 기준 — FastAPI + SQLite + JWT 인증

---

## 📋 목차

| # | 단계 |
|---|------|
| 1 | [사전 준비](#1-사전-준비) |
| 2 | [파일 배치](#2-파일-배치) |
| 3 | [Python 패키지 설치](#3-python-패키지-설치) |
| 4 | [보안 설정](#4-보안-설정--필수) |
| 5 | [개발용 실행](#5-개발용-실행) |
| 6 | [운영용 실행 — systemd](#6-운영용-실행--systemd) |
| 7 | [방화벽 설정](#7-방화벽-설정) |
| 8 | [동작 확인](#8-동작-확인) |
| 9 | [문제 해결](#9-문제-해결) |

---

## 1. 사전 준비

Ubuntu 22.04에는 **Python 3.10**이 기본 포함되어 있습니다.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv
```

```bash
python3 --version   # Python 3.10.x 확인
pip3 --version
```

---

## 2. 파일 배치

앱 파일 전체를 서버에 복사합니다. 예시 경로: `/opt/memoapp`

```bash
sudo mkdir -p /opt/memoapp
sudo cp -r ./* /opt/memoapp/
sudo chown -R $USER:$USER /opt/memoapp
cd /opt/memoapp
```

배치 후 디렉터리 구조:

```
/opt/memoapp/
├── main.py          ← FastAPI 앱 진입점, 라우터
├── auth.py          ← JWT 발급 / 검증 / refresh 로직
├── database.py      ← SQLite 연결 설정
├── models.py        ← SQLAlchemy 테이블 정의
├── schemas.py       ← Pydantic 요청·응답 스키마
├── index.html       ← 프론트엔드 (Vue 3 SPA)
├── requirements.txt ← Python 패키지 목록
└── memos.db         ← SQLite DB 파일 (첫 실행 시 자동 생성)
```

---

## 3. Python 패키지 설치

가상환경(venv)으로 패키지를 격리 설치합니다.

```bash
cd /opt/memoapp

# 가상환경 생성
python3 -m venv venv

# 가상환경 활성화
source venv/bin/activate

# 패키지 설치
pip install --upgrade pip
pip install -r requirements.txt
```

설치 확인:

```bash
pip list | grep -E "fastapi|uvicorn|sqlalchemy|jose|passlib"
```

---

## 4. 보안 설정 ⚠️ 필수

### SECRET_KEY 변경

`auth.py`의 기본 `SECRET_KEY`를 그대로 운영에 사용하면 **JWT 위조 공격**에 노출됩니다.  
반드시 배포 전에 변경하세요.

**① 랜덤 키 생성:**

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
# 출력 예: a3f9c2e1b0d4...
```

**② `auth.py` 수정:**

```python
# auth.py 13번째 줄
SECRET_KEY = "여기에-위에서-생성한-키를-붙여넣기"
```

> **팁:** 환경변수로 관리하면 코드에 키를 하드코딩하지 않아도 됩니다.
>
> ```bash
> export MEMO_SECRET_KEY="생성된-랜덤-키"
> ```
>
> ```python
> # auth.py
> import os
> SECRET_KEY = os.getenv("MEMO_SECRET_KEY", "dev-fallback-key")
> ```

---

## 5. 개발용 실행

테스트·개발 목적의 간단 실행입니다.

```bash
cd /opt/memoapp
source venv/bin/activate

# 일반 실행
uvicorn main:app --host 0.0.0.0 --port 8000

# 파일 변경 시 자동 재시작 (개발 전용)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

종료: `Ctrl + C`

---

## 6. 운영용 실행 — systemd

서버 재부팅 후에도 앱이 자동으로 시작되도록 서비스로 등록합니다.

### ① 서비스 파일 생성

```bash
sudo nano /etc/systemd/system/memoapp.service
```

아래 내용을 붙여넣고, `User`와 `MEMO_SECRET_KEY` 값을 수정합니다.

```ini
[Unit]
Description=메모앱 FastAPI Server
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/memoapp
Environment="PATH=/opt/memoapp/venv/bin"
Environment="MEMO_SECRET_KEY=여기에-랜덤-키"
ExecStart=/opt/memoapp/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### ② 서비스 등록 및 시작

```bash
sudo systemctl daemon-reload          # 설정 반영
sudo systemctl start memoapp          # 시작
sudo systemctl enable memoapp         # 부팅 시 자동 시작
sudo systemctl status memoapp         # 상태 확인
```

### ③ 이후 관리 명령어

| 명령어 | 설명 |
|--------|------|
| `sudo systemctl stop memoapp` | 중지 |
| `sudo systemctl restart memoapp` | 재시작 |
| `sudo journalctl -u memoapp -f` | 실시간 로그 |
| `sudo journalctl -u memoapp --since "1 hour ago"` | 최근 1시간 로그 |

---

## 7. 방화벽 설정

```bash
sudo ufw allow ssh          # SSH 접속 유지 (먼저 실행)
sudo ufw allow 8000/tcp     # 앱 포트 오픈
sudo ufw enable             # 방화벽 활성화
sudo ufw status             # 상태 확인
```

> SSH를 허용하기 전에 방화벽을 활성화하면 원격 접속이 끊길 수 있으니 순서를 지키세요.

---

## 8. 동작 확인

### 브라우저 접속

| URL | 설명 |
|-----|------|
| `http://서버IP:8000` | 메모앱 메인 화면 |
| `http://서버IP:8000/docs` | Swagger UI (API 테스트) |
| `http://서버IP:8000/redoc` | ReDoc (API 문서) |

### curl로 API 테스트

```bash
# 1. 회원가입
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test1234"}'

# 2. 로그인 → access_token + refresh_token 발급
curl -X POST http://localhost:8000/auth/token \
  -d "username=testuser&password=test1234"

# 3. 토큰 갱신
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"발급받은-refresh-token"}'
```

---

## 9. 문제 해결

### 포트 8000이 이미 사용 중

```bash
sudo lsof -i :8000        # 점유 프로세스 확인
sudo kill -9 <PID>        # 프로세스 종료
```

### bcrypt 빌드 오류

```bash
sudo apt install -y gcc libffi-dev
pip install passlib[bcrypt]
```

### DB 초기화 (데이터 전체 삭제)

```bash
rm -f /opt/memoapp/memos.db
sudo systemctl restart memoapp   # 재시작 시 빈 DB 자동 생성
```

### 가상환경 활성화를 잊었을 때

```bash
source /opt/memoapp/venv/bin/activate
```

---

## 📌 토큰 만료 시간 설정

`auth.py`에서 조정할 수 있습니다.

```python
ACCESS_TOKEN_EXPIRE_MINUTES = 15   # access token 유효 기간 (기본 15분)
REFRESH_TOKEN_EXPIRE_DAYS   = 7    # refresh token 유효 기간 (기본 7일)
```
