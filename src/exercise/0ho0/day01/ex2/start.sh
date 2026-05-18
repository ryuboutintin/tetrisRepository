#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if ! python3 -m pip --version >/dev/null 2>&1; then
  echo "ERROR: pip가 설치되어 있지 않습니다."
  echo
  echo "먼저 아래 명령을 실행하세요:"
  echo "  sudo apt update"
  echo "  sudo apt install python3-pip python3.10-venv"
  exit 1
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate

python -m pip install -r requirements.txt

echo
echo "서버를 시작합니다."
echo "브라우저 주소: http://127.0.0.1:8000"
echo "원격/컨테이너 환경이면 IDE의 8000번 포트 forwarded URL을 여세요."
echo

uvicorn main:app --reload --host 0.0.0.0 --port 8000
