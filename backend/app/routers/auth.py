from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, XeroConnection
from app.services.xero_service import xero_service as xero_svc
from app.utils.encryption import encrypt

router = APIRouter()

# ---------------------------------------------------------------------------
# Security constants and helpers
# ---------------------------------------------------------------------------

_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = 60
_REFRESH_TOKEN_EXPIRE_DAYS = 30

_bearer_scheme = HTTPBearer()

# Xero redirects the browser back to /xero/callback via a plain top-level GET,
# which can't carry the localStorage Bearer token. The initiating user is
# instead correlated via this short-lived state -> user_id mapping, which also
# gives the OAuth `state` param its CSRF-protection purpose.
_OAUTH_STATE_TTL_SECONDS = 600


def _get_redis() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)

# bcrypt operates on at most 72 bytes and rejects longer inputs, so we truncate
# to that boundary before hashing/verifying (the historical bcrypt behaviour).
_BCRYPT_MAX_BYTES = 72


def _hash_password(plain: str) -> str:
    pwd = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pwd, bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    pwd = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.checkpw(pwd, hashed.encode("utf-8"))


def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def _create_access_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "access"},
        timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def _create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=_REFRESH_TOKEN_EXPIRE_DAYS),
    )


# ---------------------------------------------------------------------------
# get_current_user dependency
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Decode JWT from Authorization Bearer header and return the active User."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[_ALGORITHM],
        )
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Create a new user account and return JWT tokens."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with that email already exists",
        )

    user = User(
        email=body.email,
        hashed_password=_hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    return TokenResponse(
        access_token=_create_access_token(str(user.id)),
        refresh_token=_create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Verify credentials and return JWT access + refresh tokens."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    return TokenResponse(
        access_token=_create_access_token(str(user.id)),
        refresh_token=_create_refresh_token(str(user.id)),
    )


@router.get("/xero/authorize")
async def xero_authorize(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, str]:
    """Return the Xero OAuth2 authorization URL with a random state token."""
    state = str(uuid.uuid4())
    redis_client = _get_redis()
    try:
        await redis_client.setex(
            f"xero_oauth_state:{state}", _OAUTH_STATE_TTL_SECONDS, str(current_user.id)
        )
    finally:
        await redis_client.aclose()
    url = xero_svc.get_authorization_url(state=state)
    return {"url": url}


@router.get("/xero/callback")
async def xero_callback(
    code: str,
    state: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RedirectResponse:
    """Exchange OAuth2 code for tokens, persist XeroConnection, redirect to dashboard."""
    redis_client = _get_redis()
    try:
        user_id = await redis_client.getdel(f"xero_oauth_state:{state}")
    finally:
        await redis_client.aclose()

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired Xero authorization state",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    current_user = result.scalar_one_or_none()
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )

    tokens = await xero_svc.exchange_code_for_tokens(code=code, db=db)
    tenants = await xero_svc.get_tenants(access_token=tokens["access_token"])

    if not tenants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Xero organisations found for this account",
        )

    tenant = tenants[0]

    result = await db.execute(
        select(XeroConnection).where(
            XeroConnection.user_id == current_user.id,
            XeroConnection.tenant_id == tenant["tenantId"],
        )
    )
    connection = result.scalar_one_or_none()

    encrypted_access = encrypt(tokens["access_token"])
    encrypted_refresh = encrypt(tokens["refresh_token"])
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=tokens.get("expires_in", 1800)
    )

    if connection is None:
        connection = XeroConnection(
            user_id=current_user.id,
            tenant_id=tenant["tenantId"],
            tenant_name=tenant.get("tenantName", ""),
            access_token=encrypted_access,
            refresh_token=encrypted_refresh,
            token_expires_at=expires_at,
            scopes=tokens.get("scope", settings.xero_scopes),
        )
        db.add(connection)
    else:
        connection.access_token = encrypted_access
        connection.refresh_token = encrypted_refresh
        connection.token_expires_at = expires_at

    await db.flush()

    # Redirect to the frontend dashboard after a successful connection
    frontend_url = getattr(settings, "frontend_dashboard_url", "http://localhost:3000/dashboard")
    return RedirectResponse(url=frontend_url, status_code=302)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Return the currently authenticated user's profile."""
    return current_user
