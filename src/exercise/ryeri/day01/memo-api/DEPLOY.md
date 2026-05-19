# 메모장 API 배포 가이드

Ubuntu 22.04 LTS 기준 설치·실행 절차입니다.

---

## 1. 시스템 패키지 설치

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git
```

> Ubuntu 22.04에는 Python 3.10이 기본 포함되어 있습니다.  
> 버전 확인: `python3 --version`

---

## 2. 프로젝트 파일 준비

### 저장소에서 클론하는 경우

```bash
git clone <저장소_URL>
cd <저장소>/src/exercise/ryeri/day01/memo-api
```

### 파일을 직접 복사한 경우

```bash
# 예시: /home/ubuntu/memo-api 에 복사했다고 가정
cd /home/ubuntu/memo-api
```

디렉터리 구조가 다음과 같은지 확인합니다.

```
memo-api/
├── main.py
├── requirements.txt
└── static/
    └── index.html
```

---

## 3. Python 가상 환경 설정

```bash
python3 -m venv venv
source venv/bin/activate
```

> 이후 명령은 가상 환경이 활성화된 상태(`(venv)` 프롬프트)에서 실행합니다.

---

## 4. 의존 패키지 설치

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

설치 확인:

```bash
pip list | grep -E "fastapi|uvicorn|jose|passlib|multipart"
```

---

## 5. 보안 설정 (운영 환경 필수)

`main.py` 상단의 `SECRET_KEY`를 반드시 교체합니다.

```bash
# 안전한 랜덤 키 생성
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

출력된 값을 `main.py`에서 교체합니다.

```python
# main.py 5번째 줄
SECRET_KEY = "여기에_생성된_랜덤_키를_붙여넣기"
```

---

## 6. 서버 실행

### 개발 모드 (코드 변경 시 자동 재시작)

```bash
uvicorn main:app --reload
```

### 운영 모드

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

> `--host 0.0.0.0` 을 지정해야 외부에서 접속할 수 있습니다.

브라우저에서 `http://<서버_IP>:8000` 으로 접속합니다.

---

## 7. 백그라운드 상시 실행 (systemd)

서버 재시작 후에도 자동으로 실행되도록 systemd 서비스로 등록합니다.

### 서비스 파일 생성

아래 명령에서 경로(`/home/ubuntu/memo-api`)와 사용자명(`ubuntu`)을 실제 환경에 맞게 수정합니다.

```bash
sudo nano /etc/systemd/system/memo-api.service
```

다음 내용을 입력합니다.

```ini
[Unit]
Description=memo-api FastAPI server
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/memo-api
ExecStart=/home/ubuntu/memo-api/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 서비스 등록 및 시작

```bash
sudo systemctl daemon-reload
sudo systemctl enable memo-api
sudo systemctl start memo-api
```

### 상태 확인 및 로그

```bash
sudo systemctl status memo-api
sudo journalctl -u memo-api -f   # 실시간 로그
```

---

## 8. 방화벽 설정 (ufw)

```bash
sudo ufw allow 8000/tcp
sudo ufw enable
sudo ufw status
```

---

## 9. Nginx 리버스 프록시 (선택 사항)

80/443 포트로 서비스하려면 Nginx를 앞단에 둡니다.

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/memo-api
```

```nginx
server {
    listen 80;
    server_name example.com;  # 도메인 또는 서버 IP

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/memo-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo ufw allow 'Nginx Full'
```

---

## 10. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError` | 가상 환경 미활성화 또는 패키지 미설치 | `source venv/bin/activate` 후 `pip install -r requirements.txt` |
| `Address already in use` | 8000 포트가 이미 사용 중 | `sudo lsof -i :8000` 으로 프로세스 확인 후 종료, 또는 `--port 8001` 변경 |
| 외부에서 접속 불가 | `--host 0.0.0.0` 누락 또는 방화벽 | 실행 명령에 `--host 0.0.0.0` 추가, `sudo ufw allow 8000/tcp` 확인 |
| `jose` 관련 오류 | `cryptography` 버전 불일치 | `pip install --upgrade python-jose[cryptography]` |

---

## API 엔드포인트 요약

| 메서드 | 경로 | 설명 | 인증 필요 |
|--------|------|------|-----------|
| POST | `/auth/register` | 회원가입 | X |
| POST | `/auth/login` | 로그인 → access + refresh 토큰 | X |
| POST | `/auth/refresh` | 액세스 토큰 갱신 | X (refresh token) |
| POST | `/auth/logout` | 로그아웃 (refresh token 무효화) | X (refresh token) |
| GET | `/auth/me` | 현재 사용자 정보 | O |
| GET | `/memos` | 메모 목록 | O |
| POST | `/memos` | 메모 생성 | O |
| GET | `/memos/{id}` | 메모 조회 | O |
| PUT | `/memos/{id}` | 메모 수정 | O |
| DELETE | `/memos/{id}` | 메모 삭제 | O |
| GET | `/categories` | 카테고리 목록 | O |

FastAPI 자동 문서: `http://<서버_IP>:8000/docs`
