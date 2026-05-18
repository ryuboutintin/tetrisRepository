# 메모장 (Memo App)

FastAPI 기반의 CRUD 메모 웹 애플리케이션입니다.  
JWT 인증, 태그/카테고리 분류 기능을 포함합니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | FastAPI + Uvicorn |
| Database | SQLite + SQLAlchemy ORM |
| Frontend | HTML + CSS + Vanilla JS |
| 인증 | JWT (python-jose + passlib/bcrypt) |
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

## 사용 방법

### 회원가입 & 로그인

1. 브라우저에서 http://localhost:8000 접속
2. "회원가입" 탭 클릭 → 사용자명/비밀번호 입력 → 가입
3. "로그인" 탭에서 사용자명/비밀번호 입력 → 로그인
4. 로그인 후 메모 앱 화면이 표시됩니다

### 메모 작성

1. 제목과 내용을 입력합니다.
2. 카테고리를 선택합니다 (일반, 업무, 개인, 아이디어, 할일).
3. 태그를 쉼표로 구분하여 입력합니다 (예: `python, fastapi, 학습`).
4. "저장" 버튼을 클릭합니다.
5. 메모가 즉시 목록에 추가됩니다.

### 메모 수정

1. 수정하려는 메모의 "수정" 버튼을 클릭합니다.
2. 폼에 기존 제목/내용/카테고리/태그가 자동으로 채워집니다.
3. 내용을 수정한 후 "수정" 버튼을 클릭합니다.
4. "취소" 버튼으로 수정을 취소할 수 있습니다.

### 메모 삭제

1. 삭제하려는 메모의 "삭제" 버튼을 클릭합니다.
2. 확인 대화상자에서 "확인"을 누르면 삭제됩니다.

### 필터링

- **카테고리 필터**: 드롭다운에서 카테고리를 선택하면 해당 카테고리 메모만 표시
- **태그 필터**: 태그명을 입력하면 해당 태그를 포함한 메모만 표시

### 로그아웃

- 우측 상단의 "로그아웃" 버튼 클릭

---

## API 명세

### 인증 API

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/auth/register` | 회원가입 | 불필요 |
| POST | `/auth/login` | 로그인 (토큰 발급) | 불필요 |
| GET | `/auth/me` | 현재 사용자 정보 | 필요 |

### 메모 API (인증 필요)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 메모장 UI 페이지 |
| POST | `/memos` | 메모 생성 |
| GET | `/memos` | 메모 전체 목록 조회 |
| GET | `/memos/{id}` | 메모 단일 조회 |
| PUT | `/memos/{id}` | 메모 수정 |
| DELETE | `/memos/{id}` | 메모 삭제 |
| GET | `/tags` | 전체 태그 목록 조회 |

### 요청/응답 예시

**회원가입 (POST /auth/register)**
```json
// Request Body
{
  "username": "heesung",
  "password": "mypassword"
}

// Response (201)
{
  "id": 1,
  "username": "heesung",
  "created_at": "2026-05-18T07:00:00"
}
```

**로그인 (POST /auth/login)**
```
Content-Type: application/x-www-form-urlencoded
Body: username=heesung&password=mypassword

// Response (200)
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**메모 생성 (POST /memos)**
```json
// Request Header: Authorization: Bearer <token>
// Request Body
{
  "title": "오늘의 할 일",
  "content": "FastAPI 공부하기",
  "category": "업무",
  "tags": ["python", "fastapi"]
}

// Response (201)
{
  "id": 1,
  "title": "오늘의 할 일",
  "content": "FastAPI 공부하기",
  "category": "업무",
  "tags": [{"id": 1, "name": "python"}, {"id": 2, "name": "fastapi"}],
  "created_at": "2026-05-18T07:00:00",
  "updated_at": "2026-05-18T07:00:00",
  "owner_id": 1
}
```

**메모 수정 (PUT /memos/1)**
```json
// Request Header: Authorization: Bearer <token>
// Request Body
{
  "title": "수정된 제목",
  "content": "수정된 내용",
  "category": "개인",
  "tags": ["일상"]
}
```

**메모 삭제 (DELETE /memos/1)**
```json
// Request Header: Authorization: Bearer <token>
// Response (200)
{
  "message": "메모가 삭제되었습니다"
}
```

---

## 프로젝트 구조

```
memo-app/
├── main.py           # FastAPI 앱 (라우터, CORS, 인증/메모/태그 엔드포인트)
├── database.py       # DB 엔진, 세션 설정
├── models.py         # SQLAlchemy ORM 모델 (User, Memo, Tag, memo_tags)
├── schemas.py        # Pydantic 요청/응답 스키마
├── crud.py           # DB CRUD 함수
├── auth.py           # JWT 인증 (토큰 생성/검증, 비밀번호 해싱)
├── templates/
│   └── index.html    # 프론트엔드 HTML (로그인 + 메모 UI)
├── static/
│   ├── style.css     # 스타일시트
│   └── app.js        # 인증 + API 호출 + 필터링 로직
├── requirements.txt  # 의존성 목록
└── README.md         # 사용설명서 (이 파일)
```

---

## curl 테스트

```bash
# 1. 회원가입
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"1234"}'

# 2. 로그인 (토큰 획득)
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test&password=1234" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 3. 메모 생성 (태그/카테고리 포함)
curl -X POST http://localhost:8000/memos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"테스트","content":"내용","category":"업무","tags":["python","api"]}'

# 4. 목록 조회
curl http://localhost:8000/memos \
  -H "Authorization: Bearer $TOKEN"

# 5. 수정
curl -X PUT http://localhost:8000/memos/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"수정","content":"수정 내용","category":"개인","tags":["일상"]}'

# 6. 삭제
curl -X DELETE http://localhost:8000/memos/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Swagger 문서

서버 실행 후 아래 주소에서 자동 생성된 API 문서를 확인할 수 있습니다:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
