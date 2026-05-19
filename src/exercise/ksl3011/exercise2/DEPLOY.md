# 메모앱 배포 가이드 (Ubuntu 22.04 기준)

이 문서는 Ubuntu 22.04 LTS 바닐라 서버에서 메모앱을 처음 설치하고 실행하는 전 과정을 설명합니다.

---

## 1. 시스템 요구사항 확인

Ubuntu 22.04에는 Python 3.10이 기본 설치되어 있습니다.

```bash
python3 --version   # Python 3.10.x 이상이면 OK
git --version       # git이 없으면 아래에서 설치
```

---

## 2. 필수 패키지 설치

```bash
sudo apt update
sudo apt install -y git python3-pip python3-venv
```

---

## 3. 저장소 클론

```bash
git clone https://github.com/weable-kosa/kosa-vibecoding-2026-2nd.git
cd kosa-vibecoding-2026-2nd/src/exercise/ksl3011/exercise2
```

---

## 4. Python 가상 환경 생성 및 패키지 설치

가상 환경을 사용하면 시스템 Python과 충돌 없이 패키지를 관리할 수 있습니다.

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

설치가 완료되면 다음 명령으로 확인합니다.

```bash
pip list | grep -E "fastapi|uvicorn|jose|passlib"
```

---

## 5. 앱 실행

터미널 두 개가 필요합니다. 각각을 별도 탭/창으로 열어 사용하세요.

### 터미널 1 — 백엔드 (FastAPI, 포트 8000)

```bash
cd kosa-vibecoding-2026-2nd/src/exercise/ksl3011/exercise2
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> `--reload` 옵션은 개발 중 코드 변경 시 자동 재시작합니다. 운영 환경에서는 제거하세요.

### 터미널 2 — 프론트엔드 정적 서버 (포트 8080)

```bash
cd kosa-vibecoding-2026-2nd/src/exercise/ksl3011/exercise2
python3 -m http.server 8080
```

---

## 6. 접속 확인

브라우저에서 아래 주소로 접속합니다.

| 대상 | 주소 |
|------|------|
| 앱 화면 | `http://localhost:8080/index.html` |
| API 문서 (Swagger) | `http://localhost:8000/docs` |

서버 IP로 외부에서 접근할 경우 `localhost` 대신 서버의 공인 IP를 사용합니다.

---

## 7. 방화벽 설정 (외부 접근 허용 시)

로컬에서만 쓸 경우 이 단계는 건너뛰어도 됩니다.

```bash
sudo ufw allow 8000/tcp   # 백엔드 API
sudo ufw allow 8080/tcp   # 프론트엔드
sudo ufw enable
sudo ufw status
```

---

## 8. 백그라운드 실행 (선택)

SSH를 끊어도 앱을 계속 실행하려면 `nohup`을 사용합니다.

```bash
# 백엔드
nohup venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &

# 프론트엔드
nohup python3 -m http.server 8080 > frontend.log 2>&1 &
```

실행 중인 프로세스 확인 및 종료:

```bash
ps aux | grep -E "uvicorn|http.server"
kill <PID>
```

---

## 9. 데이터 저장 위치

SQLite 데이터베이스 파일은 아래 경로에 자동 생성됩니다.

```
exercise2/data/memos.db
```

백업 시 이 파일을 복사하면 됩니다.

---

## 10. 자주 발생하는 오류

| 증상 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError: No module named 'fastapi'` | 가상 환경 미활성화 | `source venv/bin/activate` 실행 후 재시도 |
| `Address already in use` | 포트가 이미 사용 중 | `sudo lsof -i :8000` 으로 PID 확인 후 `kill <PID>` |
| 브라우저에서 API 연결 안 됨 | 백엔드가 실행되지 않은 상태 | 터미널 1의 uvicorn이 정상 실행 중인지 확인 |
| 회원가입/로그인 422 오류 | 아이디 3자 미만 또는 비밀번호 6자 미만 | 아이디 3자 이상, 비밀번호 6자 이상으로 입력 |
