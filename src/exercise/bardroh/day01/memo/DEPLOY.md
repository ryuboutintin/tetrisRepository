# 배포 가이드 — 메모장 앱 (Ubuntu 22.04 기준)

## 사전 요구사항

| 항목 | 최소 사양 |
|------|-----------|
| OS | Ubuntu 22.04 LTS (바닐라) |
| Python | 3.10 이상 (Ubuntu 22.04 기본 탑재) |
| 포트 | 8001 (또는 원하는 포트) |
| 권한 | sudo 가능한 일반 사용자 |

---

## 1단계 — 시스템 패키지 업데이트

```bash
sudo apt update && sudo apt upgrade -y
```

Ubuntu 22.04에는 Python 3.10이 기본 탑재되어 있습니다. 버전을 확인하세요.

```bash
python3 --version   # Python 3.10.x 이상이면 OK
```

pip가 없는 경우 설치합니다.

```bash
sudo apt install -y python3-pip
```

---

## 2단계 — 소스 코드 준비

저장소를 클론하고 앱 디렉터리로 이동합니다.

```bash
git clone https://github.com/weable-kosa/kosa-vibecoding-2026-2nd.git
cd kosa-vibecoding-2026-2nd/src/exercise/bardroh/day01/memo
```

---

## 3단계 — 가상환경 생성 및 패키지 설치

시스템 Python을 오염시키지 않도록 가상환경을 사용합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

설치가 완료되면 아래 명령으로 확인합니다.

```bash
pip list | grep -E "fastapi|uvicorn|jose|passlib"
```

---

## 4단계 — 환경변수 설정 (필수)

JWT 서명에 사용하는 시크릿 키를 설정합니다.  
**이 값을 설정하지 않으면 기본값(개발용)이 사용되어 보안에 취약합니다.**

```bash
# 안전한 랜덤 키 생성
python3 -c "import secrets; print(secrets.token_hex(32))"
```

출력된 값을 복사한 뒤 환경변수로 내보냅니다.

```bash
export SECRET_KEY="여기에_위에서_생성한_값을_붙여넣기"
```

세션을 재시작해도 유지되게 하려면 `~/.bashrc` (또는 `~/.profile`)에 추가하세요.

```bash
echo 'export SECRET_KEY="여기에_위에서_생성한_값을_붙여넣기"' >> ~/.bashrc
source ~/.bashrc
```

---

## 5단계 — 서버 실행

### 간단 실행 (테스트용)

```bash
source .venv/bin/activate   # 가상환경이 꺼져 있다면 다시 활성화
uvicorn main:app --host 0.0.0.0 --port 8001
```

브라우저에서 `http://<서버IP>:8001` 로 접속합니다.

- 프론트엔드: `http://<서버IP>:8001`
- Swagger UI: `http://<서버IP>:8001/docs`

### 코드 변경 시 자동 재시작 (개발용)

```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 6단계 — systemd 서비스 등록 (운영용)

서버 재부팅 후에도 자동으로 실행되도록 systemd에 등록합니다.

### 서비스 파일 작성

`<your-user>` 와 `<your-secret>` 를 실제 값으로 바꿔서 실행하세요.

```bash
sudo tee /etc/systemd/system/memo.service > /dev/null <<EOF
[Unit]
Description=Memo FastAPI App
After=network.target

[Service]
User=<your-user>
WorkingDirectory=/home/<your-user>/kosa-vibecoding-2026-2nd/src/exercise/bardroh/day01/memo
ExecStart=/home/<your-user>/kosa-vibecoding-2026-2nd/src/exercise/bardroh/day01/memo/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001
Restart=on-failure
RestartSec=5
Environment="SECRET_KEY=<your-secret>"

[Install]
WantedBy=multi-user.target
EOF
```

### 서비스 활성화 및 시작

```bash
sudo systemctl daemon-reload
sudo systemctl enable memo
sudo systemctl start memo
```

### 상태 확인 및 로그 조회

```bash
sudo systemctl status memo
sudo journalctl -u memo -f   # 실시간 로그
```

---

## 방화벽 설정 (ufw 사용 시)

Ubuntu 22.04의 기본 방화벽 ufw로 포트를 엽니다.

```bash
sudo ufw allow 8001/tcp
sudo ufw enable
sudo ufw status
```

---

## 파일 구조

```
memo/
├── main.py          # FastAPI 앱 (JWT 인증 + CRUD API + 카테고리·태그·소유권)
├── index.html       # 프론트엔드 HTML
├── app.js           # 프론트엔드 JS (인증·필터·카드 렌더링)
├── style.css        # 스타일 (그리드·카드·필터 바·카테고리 배지·태그 칩)
├── requirements.txt # Python 의존성
├── memos.db         # SQLite DB (첫 실행 시 자동 생성)
├── CLAUDE.md        # Claude Code 작업 가이드
└── DEPLOY.md        # 이 문서
```

`memos.db` 는 서버 최초 실행 시 자동으로 생성됩니다.

---

## 데이터 백업

SQLite 파일 하나를 복사하면 전체 데이터가 백업됩니다.

```bash
cp memos.db memos.db.bak
```

---

## 트러블슈팅

| 증상 | 원인 및 해결 방법 |
|------|------------------|
| `ModuleNotFoundError: No module named 'fastapi'` | 가상환경이 비활성화 상태. `source .venv/bin/activate` 실행 후 재시도 |
| `ModuleNotFoundError: No module named 'jose'` | `pip install -r requirements.txt` 재실행 |
| `Address already in use` | 8001 포트가 사용 중. `sudo lsof -i :8001` 으로 PID 확인 후 종료 |
| 로그인 후 401 반복 | `SECRET_KEY` 환경변수가 설정되지 않아 서버 재시작마다 키가 바뀜. 4단계 확인 |
| `bcrypt` 관련 경고 | `pip install bcrypt --upgrade` 로 최신 버전 설치 |
| 기존 메모가 로그인 후 안 보임 | DB에 `user_id = NULL` 인 메모 존재. 서버 재시작 시 자동으로 첫 번째 사용자에게 귀속됨 |
