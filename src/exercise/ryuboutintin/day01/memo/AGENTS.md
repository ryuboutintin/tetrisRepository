# Repository Guidelines

## 프로젝트 구조
이 저장소는 하나의 통합 애플리케이션이 아니라, 여러 수강생의 독립 실습 결과물을 모아둔 저장소입니다. 주요 작업 경로는 보통 `src/exercise/<user>/day01/...` 형태입니다.

- 각 실습은 별도 디렉터리 또는 단일 스크립트로 관리합니다.
- 예시: Python CLI, 정적 HTML/CSS/JS 페이지, FastAPI 메모 앱
- 현재 디렉터리의 `memo/`는 FastAPI + SQLite 기반 실습 예제입니다.

새 작업을 추가할 때는 다른 사람 작업과 섞지 말고, 자신의 하위 디렉터리 안에서 완결되게 구성합니다.

## 실행 및 개발 명령
공통 빌드 시스템은 없습니다. 실습별로 필요한 명령을 직접 사용합니다.

- `python3 <script>.py`: 단일 Python 스크립트 실행
- `python3 -m http.server 8000`: 정적 HTML 실습 로컬 확인
- `python3 -m venv .venv && source .venv/bin/activate`: Python 가상환경 준비
- `pip install -r requirements.txt`: 실습별 의존성 설치
- `python3 app.py`: FastAPI 실습 앱 실행 예시

실행 명령은 각 실습 디렉터리의 파일 구조에 맞춰 최소 단위로 유지합니다.

## 코딩 스타일
- Python은 4칸 들여쓰기, `snake_case`, 필요한 경우 타입 힌트 사용
- HTML/CSS/JS는 2칸 들여쓰기, 의미가 드러나는 클래스명 사용
- 작은 실습은 과도한 추상화보다 읽기 쉬운 직접 구현을 우선
- 포매터나 린터가 없으면 기존 파일 스타일을 그대로 따를 것

## 검증 방법
공식 테스트 스위트는 대부분 없습니다. 변경 후 직접 실행해서 확인합니다.

- Python: 스크립트 실행 후 출력 확인
- 웹 UI: 데스크톱과 좁은 화면에서 기본 동작 확인
- API 실습: 브라우저, Swagger UI, `curl`로 CRUD 확인

자동 테스트를 추가한다면 `tests/` 아래에 `pytest` 스타일로 분리합니다.

## 커밋 및 PR 기준
- 커밋 메시지는 짧고 명확하게 작성합니다.
- 가능하면 `feat:`, `fix:`, `docs:` 같은 Conventional Commit 접두어를 사용합니다.
- PR에는 변경 요약, 수정 파일, 수동 검증 방법을 포함합니다.
- UI 변경이 있으면 스크린샷을 첨부합니다.

## 주의 사항
- `.venv/`, `__pycache__/`, `*.db` 같은 로컬 산출물은 커밋하지 않습니다.
- 브랜치 정리 시 `rebase`보다 `merge`를 우선합니다.
