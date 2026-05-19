import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

# ── 설정 ────────────────────────────────────────────
# 실서비스에서는 환경변수로 관리
ACCESS_SECRET  = "access-secret-key-change-in-production"
REFRESH_SECRET = "refresh-secret-key-change-in-production"
ALGORITHM      = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 15       # 15분
REFRESH_TOKEN_EXPIRE_DAYS   = 7        # 7일

# ── 비밀번호 해시 ────────────────────────────────────
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── 토큰 발급 ─────────────────────────────────────────
def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "type": "access", "exp": expire, "jti": secrets.token_hex(8)}
    return jwt.encode(payload, ACCESS_SECRET, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "type": "refresh", "exp": expire, "jti": secrets.token_hex(16)}
    token = jwt.encode(payload, REFRESH_SECRET, algorithm=ALGORITHM)
    # DB 저장용 만료 시각은 naive UTC (SQLite 호환)
    return token, expire.replace(tzinfo=None)


# ── 토큰 검증 ─────────────────────────────────────────
def decode_access_token(token: str = Depends(oauth2_scheme)) -> int:
    """
    Authorization: Bearer <access_token> 헤더를 검증하고 user_id를 반환.
    만료되었거나 잘못된 토큰이면 401.
    """
    try:
        payload = jwt.decode(token, ACCESS_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
        return int(payload["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Access token invalid or expired")


def decode_refresh_token(token: str) -> int:
    """
    refresh token을 검증하고 user_id를 반환.
    서명 실패·만료 시 401 (DB 상태는 라우터에서 별도 확인).
    """
    try:
        payload = jwt.decode(token, REFRESH_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise ValueError("wrong token type")
        return int(payload["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")
