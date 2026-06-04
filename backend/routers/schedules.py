from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text
from database import SessionLocal
from services.auth_service import require_admin
from models.user import User
from models.schedule import DigestSchedule
import datetime
import uuid

router = APIRouter(prefix="/schedules", tags=["schedules"])

_VALID_FREQ = {"daily", "weekly", "monthly"}
_VALID_THRESHOLD = {"high", "medium", "all"}

_HIGH = ("Élevé", "High", "high")
_MED = ("Moyen", "Medium", "medium")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ===========================================================================
# Schemas
# ===========================================================================
class DigestConfig(BaseModel):
    enabled: bool = False
    frequency: str = "weekly"
    recipients: Optional[str] = None
    risk_threshold: str = "high"


class DigestOut(DigestConfig):
    last_run_at: Optional[datetime.datetime] = None


def _serialize(row: DigestSchedule) -> dict:
    return {
        "enabled": row.enabled,
        "frequency": row.frequency,
        "recipients": row.recipients or "",
        "risk_threshold": row.risk_threshold,
        "last_run_at": row.last_run_at,
    }


def _defaults() -> dict:
    return {
        "enabled": False,
        "frequency": "weekly",
        "recipients": "",
        "risk_threshold": "high",
        "last_run_at": None,
    }


# ===========================================================================
# Endpoints
# ===========================================================================
@router.get("/digest")
def get_digest(db=Depends(get_db), user: User = Depends(require_admin)):
    """Return the current digest config for this admin (defaults if none saved)."""
    try:
        row = db.query(DigestSchedule).filter(DigestSchedule.owner_email == user.email).first()
        return _serialize(row) if row else _defaults()
    except Exception:
        return _defaults()


@router.put("/digest")
def put_digest(cfg: DigestConfig, db=Depends(get_db), user: User = Depends(require_admin)):
    """Upsert the digest config for this admin. Persists preferences only — no scheduler runs."""
    freq = cfg.frequency if cfg.frequency in _VALID_FREQ else "weekly"
    threshold = cfg.risk_threshold if cfg.risk_threshold in _VALID_THRESHOLD else "high"
    try:
        row = db.query(DigestSchedule).filter(DigestSchedule.owner_email == user.email).first()
        if not row:
            row = DigestSchedule(id=uuid.uuid4(), owner_email=user.email)
            db.add(row)
        row.enabled = bool(cfg.enabled)
        row.frequency = freq
        row.recipients = (cfg.recipients or "").strip()
        row.risk_threshold = threshold
        db.commit()
        db.refresh(row)
        return _serialize(row)
    except Exception as e:
        db.rollback()
        return {**_defaults(), "error": str(e)[:120]}


@router.post("/digest/preview")
def preview_digest(db=Depends(get_db), user: User = Depends(require_admin)):
    """Build a preview of what the next digest would contain — does NOT send any email.

    Sending is intentionally stubbed: no SMTP integration exists yet. This returns
    the summary payload the email would carry plus an explicit `sent: false`.
    """
    summary = {"total_customers": 0, "high_risk": 0, "medium_risk": 0, "predicted_churners": 0}
    try:
        def _scalar(sql):
            try:
                v = db.execute(text(sql)).fetchone()
                return int(v[0]) if v and v[0] is not None else 0
            except Exception:
                return 0

        summary["total_customers"] = _scalar("SELECT COUNT(*) FROM clients_clean")
        summary["high_risk"] = _scalar(
            f"SELECT COUNT(*) FROM churn_predictions WHERE segment_risque IN {_HIGH}")
        summary["medium_risk"] = _scalar(
            f"SELECT COUNT(*) FROM churn_predictions WHERE segment_risque IN {_MED}")
        summary["predicted_churners"] = _scalar(
            "SELECT COUNT(*) FROM churn_predictions WHERE churn_predit = 1")

        # Mark a run timestamp so the UI can show "last previewed/generated"
        row = db.query(DigestSchedule).filter(DigestSchedule.owner_email == user.email).first()
        if row:
            row.last_run_at = datetime.datetime.utcnow()
            db.commit()
    except Exception:
        db.rollback()

    return {
        "sent": False,
        "stub": True,
        "message": "Digest generated. Email delivery is not configured yet — this is a preview only.",
        "generated_at": datetime.datetime.utcnow(),
        "summary": summary,
    }
