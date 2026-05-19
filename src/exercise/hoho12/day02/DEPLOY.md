# 배포 가이드

Ubuntu 22.04 LTS 바닐라 기준으로 JWT 인증 API 서버를 설치하고 구동하는 방법입니다.

## 사전 요구사항

- Ubuntu 22.04 LTS (fresh install)
- 인터넷 연결
- 포트 8000 오픈 (방화벽 설정 필요 시 아래 참고)

---

## 1. 시스템 패키지 업데이트

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Python 설치 확인

Ubuntu 22.04에는 Python 3.10이 기본 포함되어 있습니다.

```bash
python3 --version   # Python 3.10.x 확인
pip3 --version      # pip 미설치 시 아래 명령 실행
```

pip가 없으면 설치합니다.

```bash
sudo apt install -y python3-pip
```

---

## 3. 소스 코드 준비

### 방법 A — Git으로 클론

```bash
sudo apt install -y git
git clone https://github.com/weable-kosa/kosa-vibecoding-2026-2nd.git
cd kosa-vibecoding-2026-2nd/src/exercise/hoho12/day02
```

### 방법 B — 파일 직접 복사

`main.py`와 `requirements.txt`를 서버에 복사한 뒤 해당 디렉터리로 이동합니다.

---

## 4. 가상환경 생성 및 활성화 (권장)

시스템 Python을 오염시키지 않도록 가상환경을 사용합니다.

```bash
python3 -m venv venv
source venv/bin/activate
```

> 이후 모든 명령은 가상환경이 활성화된 상태(`(venv)` 프롬프트)에서 실행합니다.

---

## 5. 의존 패키지 설치

```bash
pip install -r requirements.txt
```

설치되는 주요 패키지:

| 패키지 | 용도 |
|--------|------|
| fastapi | 웹 프레임워크 |
| uvicorn[standard] | ASGI 서버 |
| python-jose[cryptography] | JWT 생성·검증 |
| passlib[bcrypt] | 비밀번호 해싱 |
| pydantic | 요청/응답 데이터 검증 |
| python-multipart | form-data 파싱 (로그인 엔드포인트) |

---

## 6. 환경 변수 설정 (운영 환경 필수)

`main.py` 상단의 시크릿 키는 **반드시 환경 변수로 교체**해야 합니다.

```bash
export SECRET_KEY="여기에_랜덤하고_긴_문자열_입력"
export REFRESH_SECRET_KEY="여기에_또_다른_랜덤_문자열_입력"
```

랜덤 키 생성 방법:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

> 개발·테스트 목적이라면 이 단계를 건너뛰어도 서버는 실행됩니다.  
> 운영 환경에서 기본값을 그대로 사용하면 보안 취약점이 됩니다.

---

## 7. 서버 실행

### 개발 모드 (코드 변경 시 자동 재시작)

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 운영 모드

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

서버가 뜨면 아래 URL에서 확인합니다.

| URL | 설명 |
|-----|------|
| `http://<서버IP>:8000/docs` | Swagger UI (API 문서 및 테스트) |
| `http://<서버IP>:8000/redoc` | ReDoc (읽기 전용 문서) |

---

## 8. 방화벽 설정 (필요한 경우)

```bash
sudo ufw allow 8000/tcp
sudo ufw enable
sudo ufw status
```

---

## 9. 백그라운드 실행 (systemd 서비스 등록)

서버 재부팅 후에도 자동으로 실행되도록 systemd 서비스로 등록합니다.

```bash
sudo nano /etc/systemd/system/jwt-api.service
```

아래 내용을 붙여넣습니다. 경로는 실제 환경에 맞게 수정합니다.

```ini
[Unit]
Description=JWT Auth API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/kosa-vibecoding-2026-2nd/src/exercise/hoho12/day02
ExecStart=/home/ubuntu/kosa-vibecoding-2026-2nd/src/exercise/hoho12/day02/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
Environment="SECRET_KEY=여기에_랜덤하고_긴_문자열_입력"
Environment="REFRESH_SECRET_KEY=여기에_또_다른_랜덤_문자열_입력"

[Install]
WantedBy=multi-user.target
```

서비스 등록 및 시작:

```bash
sudo systemctl daemon-reload
sudo systemctl enable jwt-api
sudo systemctl start jwt-api
sudo systemctl status jwt-api   # 실행 상태 확인
```

로그 확인:

```bash
sudo journalctl -u jwt-api -f
```

---

## 10. API 동작 확인

서버가 정상적으로 뜨면 아래 순서로 테스트합니다.

### 회원가입

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "pass1234"}'
```

### 로그인

```bash
curl -X POST http://localhost:8000/auth/login \
  -F "username=testuser" \
  -F "password=pass1234"
```

응답에서 `access_token`과 `refresh_token`을 복사합니다.

### 보호 엔드포인트 접근

```bash
curl http://localhost:8000/me \
  -H "Authorization: Bearer <access_token>"
```

### Access token 갱신

```bash
curl -X POST http://localhost:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh_token>"}'
```

### 로그아웃

```bash
curl -X POST http://localhost:8000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh_token>"}'
```

---

## 주의사항

- `auth.db` (SQLite 파일)는 서버 최초 실행 시 자동 생성됩니다. 별도 DB 설치는 필요 없습니다.
- `auth.db`는 `.gitignore`에 추가하여 저장소에 올리지 않도록 합니다.
- Access token 유효기간은 **15분**, Refresh token은 **7일**입니다.
- Refresh token은 1회 사용 후 폐기됩니다 (Token Rotation). 클라이언트는 `/auth/refresh` 응답의 새 `refresh_token`으로 교체해야 합니다.
