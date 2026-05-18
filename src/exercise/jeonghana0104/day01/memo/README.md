# Claude Memo 🦀

FastAPI + SQLite 메모장. Claude 스타일 UI에 게 캐릭터 + 다크 모드 포함.

## 구조

```
memo/
├── main.py            # FastAPI 앱 (CRUD API + 정적 파일 서빙)
├── database.py        # SQLite 연결/초기화
├── models.py          # Pydantic 스키마
├── requirements.txt
├── static/
│   ├── index.html     # 프론트엔드 마크업
│   ├── style.css      # Claude 톤 + 다크 모드
│   └── app.js         # API 호출 / 자동 저장 / 테마 토글
└── memo.db            # 실행 시 자동 생성
```

## 실행

```bash
cd src/exercise/jeonghana0104/day01/memo
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

브라우저에서 http://localhost:8000 접속.

## API

| Method | Path                | 설명          |
| ------ | ------------------- | ------------- |
| GET    | `/api/memos`        | 목록 조회     |
| GET    | `/api/memos/{id}`   | 단건 조회     |
| POST   | `/api/memos`        | 새 메모 생성  |
| PUT    | `/api/memos/{id}`   | 메모 수정     |
| DELETE | `/api/memos/{id}`   | 메모 삭제     |

Swagger UI: http://localhost:8000/docs

## 기능

- 메모 생성/수정/삭제/검색
- 입력 중 자동 저장 (700ms debounce)
- `Ctrl+S` / `⌘+S` 즉시 저장
- 다크/라이트 모드 토글 (localStorage 기억, OS 설정 자동 감지)
- 게 캐릭터 살랑살랑 애니메이션
