from fastapi import APIRouter, Depends
from sqlalchemy import text
from database import get_db
from services.auth_service import require_admin
from models.user import User
from models.notification_state import NotificationState

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _compute_notifications(db) -> list[dict]:
    """Derive the live alert list from current prediction data."""
    rows = db.execute(text("""
        SELECT segment_risque,
               COUNT(*) as cnt,
               ROUND((AVG(probabilite_churn) * 100)::numeric, 1) as avg_pct,
               MAX(probabilite_churn) as max_prob
        FROM churn_predictions
        WHERE segment_risque IS NOT NULL
        GROUP BY segment_risque
    """)).fetchall()

    stats = {
        r[0]: {"count": int(r[1]), "avg_pct": float(r[2] or 0), "max_prob": float(r[3] or 0)}
        for r in rows
    }

    critical = db.execute(text(
        "SELECT COUNT(*) FROM churn_predictions WHERE probabilite_churn >= 0.9"
    )).scalar() or 0

    notifs: list[dict] = []

    if critical > 0:
        notifs.append({
            "id": "critical", "type": "critical",
            "title": f"{critical:,} customers at critical risk",
            "body": "Churn probability ≥ 90% — these accounts need immediate personal outreach.",
            "filter": "Élevé",
        })

    s = stats.get("Élevé", {})
    if s.get("count", 0):
        notifs.append({
            "id": "high", "type": "warning",
            "title": f"{s['count']:,} high-risk customers",
            "body": f"Avg probability {s['avg_pct']}%. Schedule 7-day outreach for each account.",
            "filter": "Élevé",
        })

    s = stats.get("Moyen", {})
    if s.get("count", 0):
        notifs.append({
            "id": "medium", "type": "info",
            "title": f"{s['count']:,} medium-risk customers",
            "body": f"Avg probability {s['avg_pct']}%. Prepare retention offers before risk escalates.",
            "filter": "Moyen",
        })

    s = stats.get("Faible", {})
    if s.get("count", 0):
        notifs.append({
            "id": "stable", "type": "success",
            "title": f"{s['count']:,} customers are stable",
            "body": "Low churn risk — maintain standard loyalty program engagement.",
            "filter": "Faible",
        })

    return notifs


def _upsert_state(db, user_id, notif_id: str, **fields) -> None:
    st = (
        db.query(NotificationState)
        .filter(NotificationState.user_id == user_id, NotificationState.notif_id == notif_id)
        .first()
    )
    if not st:
        st = NotificationState(user_id=user_id, notif_id=notif_id)
        db.add(st)
    for k, v in fields.items():
        setattr(st, k, v)
    db.commit()


@router.get("/")
def get_notifications(db=Depends(get_db), user: User = Depends(require_admin)):
    notifs = _compute_notifications(db)
    states = {
        s.notif_id: s
        for s in db.query(NotificationState).filter(NotificationState.user_id == user.id).all()
    }

    visible = []
    for n in notifs:
        st = states.get(n["id"])
        if st and st.dismissed:
            continue
        visible.append({**n, "seen": bool(st and st.seen)})

    unread = sum(1 for n in visible if not n["seen"])
    urgent = sum(1 for n in visible if n["type"] in ("critical", "warning") and not n["seen"])
    return {"notifications": visible, "unread": unread, "urgent": urgent}


@router.post("/{notif_id}/seen")
def mark_seen(notif_id: str, db=Depends(get_db), user: User = Depends(require_admin)):
    _upsert_state(db, user.id, notif_id, seen=True)
    return {"ok": True}


@router.post("/seen-all")
def mark_all_seen(db=Depends(get_db), user: User = Depends(require_admin)):
    for n in _compute_notifications(db):
        _upsert_state(db, user.id, n["id"], seen=True)
    return {"ok": True}


@router.delete("/{notif_id}")
def dismiss_notification(notif_id: str, db=Depends(get_db), user: User = Depends(require_admin)):
    _upsert_state(db, user.id, notif_id, dismissed=True, seen=True)
    return {"ok": True}
