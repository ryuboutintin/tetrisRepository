# 메모장 CRUD 앱

FastAPI + SQLite 백엔드, 순수 HTML/CSS/JS 프론트엔드로 구성된 메모장 웹 애플리케이션입니다.

## 파일 구조

```
memo/
├── main.py      FastAPI CRUD API (SQLite 연동)
├── memo.db      SQLite 데이터베이스 파일 (최초 실행 시 자동 생성)
├── index.html   UI 마크업
├── style.css    스타일
└── app.js       API 통신 및 렌더링 로직
```

## 실행 방법

### 1. 패키지 설치 (최초 1회)

```bash
pip install fastapi uvicorn
```

### 2. API 서버 실행

```bash
uvicorn main:app --port 8000
```

### 3. UI 서버 실행 (별도 터미널)

```bash
python3 -m http.server 8765
```

### 4. 브라우저 접속

```
http://localhost:8765
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/memos` | 전체 메모 목록 (최신순) |
| POST | `/memos` | 메모 생성 |
| GET | `/memos/{id}` | 단건 조회 |
| PATCH | `/memos/{id}` | 부분 수정 (title/content 선택) |
| DELETE | `/memos/{id}` | 삭제 |

Swagger UI: `http://localhost:8000/docs`

## UI 기능

- 메모 추가: 제목 입력 후 Enter → 내용 → Ctrl+Enter 또는 추가 버튼
- 인라인 수정: 카드의 수정 버튼 클릭 → 카드 자체가 편집 폼으로 전환
- 삭제: 삭제 버튼 클릭 → 확인 모달 후 삭제
- 최신순 정렬

## 데이터베이스

- SQLite 사용 (`memo.db` 파일로 저장)
- 서버 재시작 후에도 데이터 유지
- 외부 패키지 없이 파이썬 내장 `sqlite3` 모듈 사용
