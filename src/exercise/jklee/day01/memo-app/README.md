# Memo App (FastAPI)

SQLite 기반 메모장 CRUD API (FastAPI + SQLAlchemy 2.0 ORM).

## 1. 패키지 설치

```bash
pip install fastapi uvicorn sqlalchemy
```

> 처음 설치라면 [PATH 안내](#참고)도 함께 확인하세요.
> SQLite 드라이버(`sqlite3`)는 Python 표준 라이브러리에 포함돼 별도 설치가 필요 없습니다.

## 2. 서버 실행

이 디렉토리에서:

```bash
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

- `app:app` = `app.py` 파일의 `app` FastAPI 인스턴스
- `--reload` = 코드 수정 시 자동 재시작 (개발용)

## 3. 자동 생성 API 문서

서버가 뜨면 브라우저에서 열어보세요.

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc:      http://127.0.0.1:8000/redoc
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

## 4. 엔드포인트

| Method | Path           | 설명             |
|--------|----------------|------------------|
| POST   | /memos         | 메모 생성        |
| GET    | /memos         | 전체 메모 목록   |
| GET    | /memos/{id}    | 특정 메모 조회   |
| PUT    | /memos/{id}    | 메모 수정        |
| DELETE | /memos/{id}    | 메모 삭제        |

존재하지 않는 `id`로 GET/PUT/DELETE를 호출하면 **404**가 반환됩니다.

## 5. curl로 테스트

생성:
```bash
curl -X POST http://127.0.0.1:8000/memos \
  -H "Content-Type: application/json" \
  -d '{"title":"첫 메모","content":"안녕하세요"}'
```

전체 조회:
```bash
curl http://127.0.0.1:8000/memos
```

단건 조회:
```bash
curl http://127.0.0.1:8000/memos/1
```

수정:
```bash
curl -X PUT http://127.0.0.1:8000/memos/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"수정된 제목","content":"수정된 내용"}'
```

삭제:
```bash
curl -X DELETE http://127.0.0.1:8000/memos/1 -i
```

404 확인:
```bash
curl -i http://127.0.0.1:8000/memos/9999
```

## 6. /docs 페이지로 테스트하는 법

1. 위의 명령어로 서버 실행
2. 브라우저에서 http://127.0.0.1:8000/docs 접속
3. 테스트할 엔드포인트(예: `POST /memos`) 클릭 → **Try it out**
4. Request body에 JSON 입력 → **Execute**
5. 아래 Responses 영역에서 결과 확인

## 7. 데이터 저장소 (SQLite)

- 데이터는 SQLAlchemy ORM을 통해 **`memo.db`** SQLite 파일에 저장됩니다.
- 서버를 처음 실행하면 `app.py` 와 같은 폴더에 `memo.db` 가 **자동 생성**됩니다.
- **서버를 껐다 켜도 메모가 그대로 남아있습니다.** 재시작 후 `GET /memos` 로 확인하세요.

### memo.db 직접 들여다보기

**옵션 A — GUI: DB Browser for SQLite (추천)**

- 다운로드: https://sqlitebrowser.org
- 설치 후 실행 → `Open Database` → `memo-app/memo.db` 선택 → `Browse Data` 탭에서 `memos` 테이블 확인.
- 또는 macOS 에서 Homebrew: `brew install --cask db-browser-for-sqlite`

**옵션 B — CLI: 표준 `sqlite3`**

```bash
cd src/exercise/jklee/day01/memo-app
sqlite3 memo.db
```
```sql
.tables                 -- 테이블 목록
.schema memos           -- 스키마 확인
SELECT * FROM memos;    -- 전체 조회
.quit
```

**옵션 C — VS Code 확장**

- 확장 마켓플레이스에서 "SQLite Viewer" (by Florian Klampfer) 검색 후 설치.
- 사이드바에서 `memo.db` 더블클릭하면 테이블 뷰가 열립니다.

### 초기화하고 싶다면

그냥 파일 삭제:

```bash
rm src/exercise/jklee/day01/memo-app/memo.db
```

다음 서버 실행 때 빈 DB가 새로 만들어집니다.

## 참고

- 처음 설치 후 `uvicorn` 명령어가 안 잡히면 `~/.zshrc` 에 다음을 추가하고 새 터미널을 여세요.
  ```bash
  export PATH="$HOME/Library/Python/3.9/bin:$PATH"
  ```
