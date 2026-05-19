from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="JWT Auth API",
    description="Access token(15분) + Refresh token(7일, 토큰 로테이션) 인증 서버",
)


# ── 공통 의존성 ────────────────────────────────────────

def get_current_user(
    user_id: int = Depends(auth.decode_access_token),
    db: Session = Depends(get_db),
) -> models.User:
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _issue_token_pair(user: models.User, db: Session) -> schemas.TokenPair:
    """access + refresh 토큰을 새로 발급하고 DB에 refresh token을 저장."""
    access_token = auth.create_access_token(user.id)
    refresh_token, expires_at = auth.create_refresh_token(user.id)

    db.add(models.RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=expires_at,
    ))
    db.commit()

    return schemas.TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ── Auth 엔드포인트 ────────────────────────────────────

@app.post(
    "/auth/register",
    response_model=schemas.TokenPair,
    status_code=201,
    summary="회원가입",
    description="사용자명·비밀번호로 회원가입하고 즉시 토큰 쌍을 반환합니다.",
)
def register(body: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 사용자명입니다.")
    user = models.User(
        username=body.username,
        hashed_password=auth.hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_token_pair(user, db)


@app.post(
    "/auth/login",
    response_model=schemas.TokenPair,
    summary="로그인",
    description="사용자명·비밀번호 인증 후 access token + refresh token을 반환합니다.",
)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not auth.verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="사용자명 또는 비밀번호가 올바르지 않습니다.")
    return _issue_token_pair(user, db)


@app.post(
    "/auth/refresh",
    response_model=schemas.TokenPair,
    summary="토큰 갱신 (Refresh + Rotation)",
    description="""
유효한 refresh token을 제출하면:
1. 기존 refresh token을 **즉시 폐기** (토큰 로테이션)
2. 새로운 access token + refresh token 쌍을 반환

이미 폐기된 refresh token을 재사용하면 401을 반환합니다.
""",
)
def refresh(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    # 1. JWT 서명·만료 검증
    user_id = auth.decode_refresh_token(body.refresh_token)

    # 2. DB에서 토큰 레코드 확인
    rt = (
        db.query(models.RefreshToken)
        .filter(
            models.RefreshToken.token == body.refresh_token,
            models.RefreshToken.user_id == user_id,
        )
        .first()
    )
    if not rt:
        raise HTTPException(status_code=401, detail="등록되지 않은 refresh token입니다.")
    if rt.revoked:
        raise HTTPException(status_code=401, detail="이미 폐기된 refresh token입니다.")
    if rt.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh token이 만료되었습니다.")

    # 3. 토큰 로테이션: 기존 토큰 폐기
    rt.revoked = True
    db.commit()

    # 4. 새 토큰 쌍 발급
    user = db.get(models.User, user_id)
    return _issue_token_pair(user, db)


@app.post(
    "/auth/logout",
    status_code=204,
    summary="로그아웃",
    description="전달된 refresh token을 폐기합니다. access token은 만료될 때까지 유효합니다.",
)
def logout(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    rt = (
        db.query(models.RefreshToken)
        .filter(models.RefreshToken.token == body.refresh_token)
        .first()
    )
    if rt and not rt.revoked:
        rt.revoked = True
        db.commit()


# ── 보호 엔드포인트 ────────────────────────────────────

@app.get(
    "/auth/me",
    response_model=schemas.UserResponse,
    summary="내 정보 조회 (보호)",
    description="유효한 access token이 필요합니다.",
)
def me(user: models.User = Depends(get_current_user)):
    return user


@app.get(
    "/protected/data",
    summary="보호 리소스 예시",
    description="access token 없이 접근하면 401을 반환합니다.",
)
def protected_data(user: models.User = Depends(get_current_user)):
    return {
        "message": f"안녕하세요, {user.username}님! 보호된 데이터에 접근했습니다.",
        "user_id": user.id,
        "server_time": datetime.utcnow().isoformat() + "Z",
    }


@app.get(
    "/protected/tokens",
    summary="내 refresh token 목록 조회 (보호)",
    description="로그인된 기기 목록을 확인하는 용도로 사용할 수 있습니다.",
)
def list_tokens(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    tokens = (
        db.query(models.RefreshToken)
        .filter(
            models.RefreshToken.user_id == user.id,
            models.RefreshToken.revoked == False,
            models.RefreshToken.expires_at > now,
        )
        .all()
    )
    return {
        "active_sessions": len(tokens),
        "tokens": [
            {"id": t.id, "created_at": t.created_at, "expires_at": t.expires_at}
            for t in tokens
        ],
    }
