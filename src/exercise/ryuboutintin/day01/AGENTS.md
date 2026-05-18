# Repository Guidelines

## 프로젝트 구조
이 저장소는 하나의 패키지형 애플리케이션이 아니라, 독립적으로 실행되는 작은 실습 파일들의 모음입니다.

- `pi.py`: Chudnovsky 급수로 원주율을 계산하는 Python CLI 스크립트
- `fibonacci/fibonacci.py`: 피보나치 수열을 계산하는 독립 실행형 Python 스크립트
- `personal_landing2/index.html`: CSS와 클라이언트 동작이 함께 들어 있는 단일 HTML 기반 마크다운 에디터 UI
- `h1.txt`, `text.txt`: 간단한 텍스트 샘플 또는 임시 파일

새 작업도 같은 방식으로 분리해 두는 것을 권장합니다. 새 실습을 추가할 때는 전용 디렉터리나 단일 목적 스크립트 파일로 구성하세요.

## 빌드, 테스트, 개발 명령
현재는 공통 빌드 시스템이 없습니다. 언어별 실행 명령을 직접 사용합니다.

- `python3 pi.py --terms 5 --digits 50`: 원주율 계산 스크립트 실행
- `python3 fibonacci/fibonacci.py`: 피보나치 예제 실행
- `python3 -m http.server 8000`: 저장소 루트를 로컬 서버로 실행

HTML 페이지는 `personal_landing2/index.html`을 브라우저에서 직접 열거나, 로컬 서버 실행 후 `/personal_landing2/` 경로로 접속해 확인합니다.

## 코딩 스타일과 네이밍
저장소에 이미 있는 스타일을 우선 따릅니다.

- Python: 들여쓰기 4칸, 함수/변수는 `snake_case`, 필요한 경우 타입 힌트 사용
- HTML/CSS: 들여쓰기 2칸, `.workspace`, `.preview-card`, `.topbar`처럼 의미가 드러나는 클래스명 사용
- 직접 실행하는 스크립트는 `__main__` 블록을 유지

현재 포매터나 린터는 설정되어 있지 않습니다. 기존 파일의 형식을 맞추고, 변경 범위는 작고 읽기 쉽게 유지하세요.

## 테스트 가이드
아직 공식 테스트 스위트는 없습니다. Python 로직이 커지면 추후 `tests/` 디렉터리에 `pytest` 스타일 테스트를 추가하는 방식이 적절합니다.

현재는 대상 스크립트를 직접 실행해 출력 결과를 확인하세요. UI 변경은 `personal_landing2/index.html`을 데스크톱 폭과 좁은 모바일 폭에서 모두 점검합니다.

## 커밋과 Pull Request 가이드
최근 커밋 이력은 한국어 요약과 `feat: add markdown editor...` 같은 Conventional Commit 형식이 섞여 있습니다. 가능하면 `feat:`, `fix:`, `docs:` 같은 접두어를 포함한 짧고 명령형의 메시지를 사용하세요.

브랜치 이력을 합칠 때는 `git rebase` 대신 `git merge`를 사용합니다. 유지보수자가 별도로 요청하지 않는 한 공유 이력을 재작성하지 않습니다.

Pull Request에는 변경 요약, 수정한 파일, 수동 검증 방법을 포함하세요. `personal_landing2/index.html` 같은 UI 변경이 있으면 스크린샷도 함께 첨부합니다.
