# 메모장 (Memo App)

FastAPI 기반의 CRUD 메모 웹 애플리케이션입니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | FastAPI + Uvicorn |
| Database | SQLite + SQLAlchemy ORM |
| Frontend | HTML + CSS + Vanilla JS |
| 템플릿 | Jinja2 |

---

## 설치 및 실행

### 1. 패키지 설치

```bash
cd memo-app
pip install -r requirements.txt
```

### 2. 서버 실행

```bash
uvicorn main:app --reload --port 8000
```

### 3. 브라우저 접속

```
http://localhost:8000
```

서버 실행 시 `memo.db` 파일이 자동 생성됩니다.

---

## 기능 설명

### 메모 작성
1. 제목과 내용을 입력합니다.
2. "저장" 버튼을 클릭합니다.
3. 메모가 즉시 목록에 추가됩니다.

### 메모 수정
1. 수정하려는 메모의 "수정" 버튼을 클릭합니다.
2. 폼에 기존 제목/내용이 자동으로 채워집니다.
3. 내용을 수정한 후 "수정" 버튼을 클릭합니다.
4. "취소" 버튼으로 수정을 취소할 수 있습니다.

### 메모 삭제
1. 삭제하려는 메모의 "삭제" 버튼을 클릭합니다.
2. 확인 대화상자에서 "확인"을 누르면 삭제됩니다.

---

## API 명세

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 메모장 UI 페이지 |
| POST | `/memos` | 메모 생성 |
| GET | `/memos` | 메모 전체 목록 조회 |
| GET | `/memos/{id}` | 메모 단일 조회 |
| PUT | `/memos/{id}` | 메모 수정 |
| DELETE | `/memos/{id}` | 메모 삭제 |

### 요청/응답 예시

**메모 생성 (POST /memos)**
```json
// Request Body
{
  "title": "오늘의 할 일",
  "content": "FastAPI 공부하기"
}

// Response (201)
{
  "id": 1,
  "title": "오늘의 할 일",
  "content": "FastAPI 공부하기",
  "created_at": "2026-05-18T07:00:00",
  "updated_at": "2026-05-18T07:00:00"
}
```

**메모 수정 (PUT /memos/1)**
```json
// Request Body
{
  "title": "수정된 제목",
  "content": "수정된 내용"
}
```

**메모 삭제 (DELETE /memos/1)**
```json
// Response (200)
{
  "message": "메모가 삭제되었습니다"
}
```

---

## 프로젝트 구조

```
memo-app/
├── main.py           # FastAPI 앱 (라우터, CORS, 정적파일 설정)
├── database.py       # DB 엔진, 세션 설정
├── models.py         # SQLAlchemy ORM 모델
├── schemas.py        # Pydantic 요청/응답 스키마
├── crud.py           # DB CRUD 함수
├── templates/
│   └── index.html    # 프론트엔드 HTML
├── static/
│   ├── style.css     # 스타일시트
│   └── app.js        # API 호출 및 UI 로직
├── requirements.txt  # 의존성 목록
└── README.md         # 사용설명서 (이 파일)
```

---

## curl 테스트

```bash
# 메모 생성
curl -X POST http://localhost:8000/memos \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트","content":"내용"}'

# 목록 조회
curl http://localhost:8000/memos

# 단일 조회
curl http://localhost:8000/memos/1

# 수정
curl -X PUT http://localhost:8000/memos/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"수정","content":"수정 내용"}'

# 삭제
curl -X DELETE http://localhost:8000/memos/1
```

---

## Swagger 문서

서버 실행 후 아래 주소에서 자동 생성된 API 문서를 확인할 수 있습니다:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
