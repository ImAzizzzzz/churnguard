import time
from collections import defaultdict, deque
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel as _PydanticBase
from sqlalchemy.orm import Session
from database import get_db
from models.user import User, RoleEnum
from schemas.auth import UserCreate, UserUpdate, LoginRequest, TokenResponse, UserResponse
from services.auth_service import (
    verify_password, create_token, hash_password,
    get_current_user, require_super_admin,
)
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Simple in-memory login rate limiter (per client IP) ──────────────────────
# Good enough for a single-process deployment. For multi-worker/prod, back this
# with Redis (or use slowapi).
_LOGIN_ATTEMPTS: dict[str, deque] = defaultdict(deque)
_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 300  # 5 minutes


def _check_login_rate(ip: str) -> None:
    now = time.time()
    dq = _LOGIN_ATTEMPTS[ip]
    while dq and now - dq[0] > _WINDOW_SECONDS:
        dq.popleft()
    if len(dq) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait a few minutes and try again.",
        )
    dq.append(now)


def to_resp(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone=user.phone,
        department=user.department,
        is_active=user.is_active,
        created_at=user.created_at,
        avatar=user.avatar,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    _check_login_rate(request.client.host if request.client else "unknown")
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    # Successful login clears that IP's attempt counter.
    _LOGIN_ATTEMPTS.pop(request.client.host if request.client else "unknown", None)
    token = create_token({"sub": user.email})
    return TokenResponse(access_token=token, user=to_resp(user))


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return to_resp(user)


class _UpdateMeBody(_PydanticBase):
    full_name: str | None = None
    phone: str | None = None
    department: str | None = None
    avatar: str | None = None  # base64 data URI, or "" / null to clear


@router.put("/users/me", response_model=UserResponse)
def update_me(
    body: _UpdateMeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fields = body.model_dump(exclude_unset=True)
    if "full_name" in fields and body.full_name is not None:
        stripped = body.full_name.strip()
        if stripped:
            user.full_name = stripped
    if "phone" in fields:
        user.phone = (body.phone or "").strip() or None
    if "department" in fields:
        user.department = (body.department or "").strip() or None
    if "avatar" in fields:
        user.avatar = body.avatar or None
    db.commit()
    db.refresh(user)
    return to_resp(user)


class _ChangePasswordBody(_PydanticBase):
    current_password: str
    new_password: str


@router.put("/users/me/password")
def change_my_password(
    body: _ChangePasswordBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    return [to_resp(u) for u in db.query(User).order_by(User.created_at).all()]


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        phone=body.phone,
        department=body.department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return to_resp(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(current.id) and body.role is not None and body.role != RoleEnum.super_admin:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")

    if body.email is not None:
        existing = db.query(User).filter(User.email == body.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = body.email
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.password is not None and body.password.strip():
        user.hashed_password = hash_password(body.password)
    if body.role is not None:
        user.role = body.role
    if body.phone is not None:
        user.phone = body.phone
    if body.department is not None:
        user.department = body.department
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.avatar is not None:
        user.avatar = body.avatar

    db.commit()
    db.refresh(user)
    return to_resp(user)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current: User = Depends(require_super_admin),
):
    if str(current.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
