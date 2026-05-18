# 메모장 API (FastAPI + SQLite)

FastAPI와 SQLite로 구현한 메모 CRUD API + 프런트엔드 UI

---

## 실행 방법

```bash
# 의존성 설치 (최초 1회)
pip install fastapi "uvicorn[standard]"

# 서버 기동
uvicorn main:app --reload --port 8000
```

브라우저에서 `http://localhost:8000` 접속

---

## 디렉터리 구조

```
FastAPI/
├── main.py              # FastAPI 앱 (CRUD API + 이미지 업로드)
├── memos.db             # SQLite DB (최초 실행 시 자동 생성)
├── requirements.txt     # fastapi, uvicorn[standard]
├── README.md
└── static/
    ├── index.html       # UI 뼈대
    ├── style.css        # 카드형 2단 레이아웃 스타일
    ├── app.js           # fetch API 기반 CRUD + 이미지 처리
    └── uploads/         # 업로드된 이미지 저장 디렉터리 (자동 생성)
```

---

## API 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| `GET` | `/api/memos` | 전체 메모 목록 조회 |
| `POST` | `/api/memos` | 메모 생성 |
| `GET` | `/api/memos/{id}` | 단건 조회 |
| `PUT` | `/api/memos/{id}` | 메모 수정 |
| `DELETE` | `/api/memos/{id}` | 메모 삭제 |
| `POST` | `/api/memos/{id}/image` | 이미지 첨부 |
| `DELETE` | `/api/memos/{id}/image` | 이미지 삭제 |

Swagger 문서: `http://localhost:8000/docs`

---

## 주요 기능

- 메모 CRUD (제목 + 내용)
- 이미지 첨부 / 교체 / 삭제 (JPG · PNG · GIF · WEBP)
- 이미지 클릭 시 라이트박스 원본 보기
- 실시간 검색 필터 (제목 + 내용)
- 수정 중인 카드 하이라이트
- ESC 키로 다이얼로그 · 라이트박스 닫기
