# Claude Memo 🦀

FastAPI + SQLite 기반 메모장. Claude 스타일 UI, 게 캐릭터, 다크 모드, **JWT 사용자 인증**, **카테고리/태그** 지원.

## 구조

```
memo/
├── main.py            # FastAPI 라우터 (auth + memo + category + tag)
├── auth.py            # bcrypt 해시 + JWT 발급/검증
├── database.py        # SQLite 연결/스키마
├── models.py          # Pydantic 스키마
├── requirements.txt
├── static/
│   ├── index.html     # 로그인/회원가입 + 메모 UI
│   ├── style.css      # Claude 톤 + 다크 모드
│   └── app.js         # 토큰 관리 + CRUD + 자동 저장 + 필터링
└── memo.db            # 실행 시 자동 생성
```

## 실행

```bash
cd src/exercise/jeonghana0104/day01/memo
pip install --user -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000
# 또는 ~/.local/bin이 PATH에 있으면:
# uvicorn main:app --reload --port 8000
```

브라우저에서 http://localhost:8000 접속.

> **JWT secret**은 개발용 하드코딩 값이며, 실제 배포 시 `MEMO_JWT_SECRET` 환경 변수로 덮어쓰세요.

## 기능

### 인증
- 회원가입 / 로그인 (아이디 + 비밀번호)
- bcrypt 비밀번호 해시
- JWT(HS256) Bearer 토큰, 7일 만료
- 토큰은 브라우저 `localStorage`에 저장
- 401 응답 시 자동 로그아웃

### 메모
- 메모 생성/수정/삭제, 입력 중 자동 저장 (700ms debounce), `Ctrl+S` / `⌘+S`
- 모든 메모는 작성자에게 격리 (다른 유저의 메모 접근 불가)

### 카테고리
- 메모당 1개 (없음 허용)
- 이름 + 색상 지정
- 사이드바에서 필터링 (카테고리별 메모 보기)
- 편집/삭제 (삭제 시 메모는 유지, 카테고리만 분리)

### 태그
- 메모당 여러 개 자유 입력 (Enter 또는 쉼표로 추가)
- 처음 쓰는 태그 이름이면 자동 생성
- 사이드바 태그 클라우드에서 클릭으로 필터링

### UI
- Claude 따뜻한 베이지/오렌지 톤
- 게 캐릭터 (SVG, 살랑살랑 애니메이션, 클릭 시 wiggle)
- 다크/라이트 모드 토글 (OS 설정 자동 감지)
- 검색 + 카테고리 + 태그 다중 필터 조합

## API

모든 `/api/memos`, `/api/categories`, `/api/tags` 엔드포인트는 `Authorization: Bearer <token>` 헤더가 필요합니다.

| Method | Path                          | 설명                             |
| ------ | ----------------------------- | -------------------------------- |
| POST   | `/api/auth/register`          | 회원가입 (→ token)               |
| POST   | `/api/auth/login`             | 로그인 (→ token)                 |
| GET    | `/api/auth/me`                | 현재 사용자 정보                 |
| GET    | `/api/categories`             | 내 카테고리 목록                 |
| POST   | `/api/categories`             | 카테고리 생성                    |
| PUT    | `/api/categories/{id}`        | 카테고리 수정                    |
| DELETE | `/api/categories/{id}`        | 카테고리 삭제                    |
| GET    | `/api/tags`                   | 내 태그 목록                     |
| DELETE | `/api/tags/{id}`              | 태그 삭제                        |
| GET    | `/api/memos`                  | 메모 목록 (`?q=&category_id=&tag=` 필터) |
| GET    | `/api/memos/{id}`             | 단건 조회                        |
| POST   | `/api/memos`                  | 새 메모 (`tags: [...]` 포함)     |
| PUT    | `/api/memos/{id}`             | 메모 수정                        |
| DELETE | `/api/memos/{id}`             | 메모 삭제                        |

Swagger UI: http://localhost:8000/docs
