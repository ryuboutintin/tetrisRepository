# Memo App Deployment Guide

이 문서는 Ubuntu 22.04 LTS 바닐라 서버에서 이 메모 앱을 처음 설치하고 실행하는 방법을 설명합니다.

기준 경로 예시:

- 프로젝트 경로: `/opt/memo-app`
- 실행 포트: `8000`
- Python 가상환경: `/opt/memo-app/.venv`

실제 배포 시 경로는 바꿔도 됩니다. 다만 아래 명령에서는 같은 경로를 일관되게 사용해야 합니다.

## 1. 서버 기본 패키지 설치

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git
```

확인:

```bash
python3 --version
```

Ubuntu 22.04 기본 Python은 보통 3.10 계열입니다.

## 2. 프로젝트 배치

원격 저장소에서 받는 경우:

```bash
cd /opt
sudo git clone <REPOSITORY_URL> memo-app
sudo chown -R $USER:$USER /opt/memo-app
cd /opt/memo-app
```

이미 로컬에 파일이 있다면 원하는 위치에 프로젝트를 복사한 뒤 해당 디렉터리로 이동하면 됩니다.

이 실습의 실제 앱 파일은 다음 경로에 있습니다.

```bash
cd /opt/memo-app/src/exercise/ryuboutintin/day01/memo
```

## 3. Python 가상환경 생성

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

설치 확인:

```bash
pip list
```

## 4. 환경 변수 설정

JWT 서명 키는 반드시 직접 바꿔야 합니다. 기본값 `dev-secret-change-me`를 그대로 사용하면 안 됩니다.

임시로 현재 셸에서만 적용하려면:

```bash
export MEMO_JWT_SECRET='change-this-to-a-long-random-secret'
```

운영에서는 `systemd` 서비스 파일에 넣는 방식을 권장합니다. 아래에서 같이 설정합니다.

랜덤 시크릿 예시 생성:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 5. 수동 실행으로 먼저 확인

배포 전에 수동으로 한 번 실행해서 앱이 뜨는지 확인합니다.

```bash
source .venv/bin/activate
export MEMO_JWT_SECRET='change-this-to-a-long-random-secret'
uvicorn app:app --host 0.0.0.0 --port 8000
```

브라우저 또는 서버 내부에서 확인:

- 메인 화면: `http://SERVER_IP:8000/`
- Swagger 문서: `http://SERVER_IP:8000/docs`

이번 버전의 인증 동작:

- 로그인 또는 회원가입 시 `access_token`과 `refresh_token`이 함께 발급됩니다.
- 액세스 토큰은 15분 동안 유효합니다.
- 리프레시 토큰은 7일 동안 유효하며, 토큰 갱신 시 기존 리프레시 토큰은 폐기되고 새 토큰 쌍이 발급됩니다.
- 프런트엔드는 액세스 토큰 만료 시 `/api/auth/refresh`로 자동 재발급을 시도합니다.

서버에서 직접 확인:

```bash
curl http://127.0.0.1:8000/docs
```

중지:

```bash
Ctrl + C
```

## 6. systemd 서비스 등록

서비스 계정을 따로 두고 싶다면 별도 Linux 사용자를 만들어도 됩니다. 처음 배포에서는 현재 서버 사용자 기준으로 시작해도 충분합니다.

서비스 파일 생성:

```bash
sudo nano /etc/systemd/system/memo-app.service
```

아래 내용을 넣습니다.

```ini
[Unit]
Description=FastAPI Memo App
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/memo-app/src/exercise/ryuboutintin/day01/memo
Environment="MEMO_JWT_SECRET=change-this-to-a-long-random-secret"
ExecStart=/opt/memo-app/src/exercise/ryuboutintin/day01/memo/.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

주의:

- `User`, `Group`은 실제 서버 사용자에 맞게 바꿉니다.
- `WorkingDirectory`는 실제 앱 디렉터리여야 합니다.
- `ExecStart` 경로도 실제 `.venv` 경로와 일치해야 합니다.
- `MEMO_JWT_SECRET`는 반드시 긴 랜덤 문자열로 바꿉니다.

서비스 적용:

```bash
sudo systemctl daemon-reload
sudo systemctl enable memo-app
sudo systemctl start memo-app
```

상태 확인:

```bash
sudo systemctl status memo-app
```

로그 확인:

```bash
sudo journalctl -u memo-app -f
```

## 7. 방화벽 열기

`ufw`를 쓰는 경우 8000 포트를 엽니다.

```bash
sudo ufw allow 8000/tcp
sudo ufw status
```

외부에서 접근 확인:

- `http://SERVER_IP:8000/`

## 8. 앱 업데이트 방법

코드가 바뀌었을 때:

```bash
cd /opt/memo-app
git pull
cd /opt/memo-app/src/exercise/ryuboutintin/day01/memo
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart memo-app
```

확인:

```bash
sudo systemctl status memo-app
sudo journalctl -u memo-app -n 50 --no-pager
```

## 9. 데이터 파일 위치

이 앱은 SQLite를 사용합니다.

- 데이터베이스 파일: `memo.db`

현재 코드 기준으로 `memo.db`는 앱 실행 디렉터리 안에 생성됩니다. 메모 데이터뿐 아니라 사용자 정보와 리프레시 토큰 해시도 함께 저장됩니다.

실제 경로 예시:

- `/opt/memo-app/src/exercise/ryuboutintin/day01/memo/memo.db`

백업 예시:

```bash
cp /opt/memo-app/src/exercise/ryuboutintin/day01/memo/memo.db /opt/memo-app/src/exercise/ryuboutintin/day01/memo/memo.db.backup
```

토큰 운영 주의:

- 리프레시 토큰은 원문이 아니라 SHA-256 해시로 저장됩니다.
- 로그아웃 시 해당 리프레시 토큰은 폐기 처리됩니다.
- 장기 운영 서버에서는 `memo.db` 백업 주기를 정해 두는 편이 안전합니다.

## 10. 자주 확인할 항목

- `MEMO_JWT_SECRET`를 기본값으로 두지 않았는지 확인
- `.venv` 안에 패키지가 정상 설치됐는지 확인
- `WorkingDirectory`와 `ExecStart` 경로가 실제 위치와 맞는지 확인
- `systemctl status memo-app`에서 실행 중인지 확인
- `/docs`와 `/`에 브라우저로 접속되는지 확인

## 11. 트러블슈팅

### `ModuleNotFoundError: No module named 'fastapi'`

원인:

- 가상환경이 활성화되지 않았거나
- `pip install -r requirements.txt`를 하지 않았거나
- `systemd`의 `ExecStart`가 잘못된 Python 환경을 가리키는 경우

해결:

```bash
cd /opt/memo-app/src/exercise/ryuboutintin/day01/memo
source .venv/bin/activate
pip install -r requirements.txt
which uvicorn
```

`which uvicorn` 결과가 `.venv/bin/uvicorn`인지 확인합니다.

### 앱은 실행되는데 외부 접속이 안 됨

확인:

- `--host 0.0.0.0`로 실행했는지
- 서버 방화벽에서 8000 포트를 열었는지
- 클라우드 보안 그룹이 있다면 해당 포트를 허용했는지

### JWT 관련 401 오류가 계속 남

확인:

- 서비스 재시작 전에 발급된 오래된 토큰을 브라우저가 들고 있을 수 있습니다.
- 브라우저 `localStorage`를 지우고 다시 로그인합니다.
- `MEMO_JWT_SECRET`가 실행 중간에 바뀌면 이전 토큰은 모두 무효가 됩니다.

## 12. 운영 시 권장 사항

- 8000 포트를 직접 노출하기보다 Nginx 리버스 프록시 뒤에 두는 구성이 더 안전합니다.
- `MEMO_JWT_SECRET`는 충분히 긴 랜덤 문자열을 사용합니다.
- `memo.db`는 주기적으로 백업합니다.
- 실제 운영에서는 HTTPS를 적용하는 것이 맞습니다.
