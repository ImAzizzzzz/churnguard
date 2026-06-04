from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any
import uuid

from database import get_db
from models.user import User
from models.permissions import UserPermissions
from services.auth_service import get_current_user, require_super_admin

router = APIRouter(prefix="/permissions", tags=["permissions"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BOOLEAN_FIELDS = {
    "can_view_dashboard",
    "can_view_predictions",
    "can_view_insights",
    "can_view_reports",
    "can_export_data",
    "can_batch_predict",
    "can_view_analytics",
    "show_risk_chart",
    "show_confusion_matrix",
    "show_probability_dist",
    "show_churn_by_age",
    "show_churn_by_tenure",
    "show_churn_by_balance",
    "show_churn_by_industry",
    "show_churn_by_nationality",
    # Dashboard new
    "show_revenue_at_risk",
    "show_churn_trend",
    "show_high_risk_table",
    "show_churn_by_partyclass",
    "show_churn_by_nature",
    # Insights new
    "show_insights_marital",
    "show_insights_tenure",
    "show_insights_balance",
    "show_insights_age",
    "show_insights_kyc",
    "show_cohort_compare",
    # Predict new
    "show_what_if_simulator",
}


def _get_or_create_permissions(db: Session, user_id: uuid.UUID) -> UserPermissions:
    """Return existing permissions row, creating defaults if absent."""
    perms = db.query(UserPermissions).filter(UserPermissions.user_id == user_id).first()
    if perms is None:
        perms = UserPermissions(user_id=user_id)
        db.add(perms)
        db.commit()
        db.refresh(perms)
    return perms


def _perms_to_dict(perms: UserPermissions) -> dict:
    result: dict = {"id": str(perms.id), "user_id": str(perms.user_id)}
    for field in _BOOLEAN_FIELDS:
        result[field] = getattr(perms, field)
    return result


# ---------------------------------------------------------------------------
# GET /permissions/my  — current user's permissions
# ---------------------------------------------------------------------------
@router.get("/my")
def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    perms = _get_or_create_permissions(db, current_user.id)
    return _perms_to_dict(perms)


# ---------------------------------------------------------------------------
# GET /permissions/users/{user_id}  — super_admin only
# ---------------------------------------------------------------------------
@router.get("/users/{user_id}")
def get_user_permissions(
    user_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")

    target = db.query(User).filter(User.id == uid).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    perms = _get_or_create_permissions(db, uid)
    return _perms_to_dict(perms)


# ---------------------------------------------------------------------------
# PUT /permissions/users/{user_id}  — super_admin only
# ---------------------------------------------------------------------------
@router.put("/users/{user_id}")
def update_user_permissions(
    user_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")

    target = db.query(User).filter(User.id == uid).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    perms = _get_or_create_permissions(db, uid)

    unknown_fields = [k for k in body if k not in _BOOLEAN_FIELDS]
    if unknown_fields:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown permission field(s): {unknown_fields}",
        )

    for field, value in body.items():
        if not isinstance(value, bool):
            raise HTTPException(
                status_code=422,
                detail=f"Field '{field}' must be a boolean value",
            )
        setattr(perms, field, value)

    db.commit()
    db.refresh(perms)
    return _perms_to_dict(perms)


# ---------------------------------------------------------------------------
# GET /permissions/all  — super_admin only
# ---------------------------------------------------------------------------
@router.get("/all")
def get_all_permissions(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    users = db.query(User).order_by(User.created_at).all()
    result = []
    for user in users:
        perms = _get_or_create_permissions(db, user.id)
        entry = {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "is_active": user.is_active,
            },
            "permissions": _perms_to_dict(perms),
        }
        result.append(entry)
    return result
