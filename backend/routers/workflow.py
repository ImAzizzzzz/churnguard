from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text
from database import SessionLocal
from services.auth_service import require_admin
from models.user import User
import datetime
import uuid

router = APIRouter(prefix="/workflow", tags=["workflow"])

# Risk-segment labels treated as "high risk" (FR + EN variants)
_HIGH_RISK_LABELS = ("Élevé", "High", "high")
# Normalise any risk label to a coarse rank so we can detect migration direction.
_RISK_RANK = {
    "Élevé": 2, "High": 2, "high": 2,
    "Moyen": 1, "Medium": 1, "medium": 1,
    "Faible": 0, "Low": 0, "low": 0,
}

_VALID_STATUS = {"open", "in_progress", "done"}
_VALID_OUTCOME = {"pending", "retained", "churned"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ===========================================================================
# Schemas
# ===========================================================================
class WatchlistCreate(BaseModel):
    customer_no: str
    account_no: Optional[str] = None
    note: Optional[str] = None


class InterventionCreate(BaseModel):
    customer_no: str
    account_no: Optional[str] = None
    action: str
    note: Optional[str] = None


class InterventionUpdate(BaseModel):
    status: Optional[str] = None
    outcome: Optional[str] = None
    note: Optional[str] = None


# ===========================================================================
# Watchlist
# ===========================================================================
@router.get("/watchlist")
def list_watchlist(
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    """Watchlist entries enriched with current risk data from churn_predictions."""
    try:
        # DISTINCT ON (w.id): a customer holds many accounts, so a plain join fans
        # one watchlist entry into many rows (phantom duplicates + delete 404s).
        # Pick the highest-risk account row to enrich each entry, exactly once.
        rows = db.execute(text("""
            SELECT * FROM (
                SELECT DISTINCT ON (w.id)
                    w.id, w.customer_no, w.account_no, w.note,
                    w.added_by_name, w.created_at,
                    c.acct_balance, c.tenure, c.partyclass,
                    p.probabilite_churn, p.segment_risque
                FROM watchlist w
                LEFT JOIN clients_clean c
                       ON CAST(c.customer_no AS TEXT) = w.customer_no
                LEFT JOIN churn_predictions p
                       ON c.customer_no = p.customer_no
                      AND c.account_no  = p.account_no
                ORDER BY w.id, p.probabilite_churn DESC NULLS LAST
            ) sub
            ORDER BY created_at DESC
        """)).fetchall()
    except Exception:
        return {"items": []}

    items = []
    for r in rows:
        items.append({
            "id": str(r[0]),
            "customer_no": r[1],
            "account_no": r[2],
            "note": r[3],
            "added_by_name": r[4],
            "created_at": r[5].isoformat() if r[5] else None,
            "acct_balance": float(r[6]) if r[6] is not None else None,
            "tenure": float(r[7]) if r[7] is not None else None,
            "partyclass": r[8],
            "probabilite_churn": float(r[9]) if r[9] is not None else None,
            "segment_risque": r[10],
        })
    return {"items": items}


@router.post("/watchlist")
def add_watchlist(
    body: WatchlistCreate,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    # Avoid duplicates for the same customer
    existing = db.execute(
        text("SELECT id FROM watchlist WHERE customer_no = :cn LIMIT 1"),
        {"cn": body.customer_no},
    ).fetchone()
    if existing:
        return {"id": str(existing[0]), "already": True}

    new_id = uuid.uuid4()
    db.execute(text("""
        INSERT INTO watchlist (id, customer_no, account_no, note, added_by, added_by_name, created_at)
        VALUES (:id, :cn, :an, :note, :by, :byname, :ts)
    """), {
        "id": new_id, "cn": body.customer_no, "an": body.account_no,
        "note": body.note, "by": str(user.id),
        "byname": user.full_name or user.email, "ts": datetime.datetime.utcnow(),
    })
    db.commit()
    return {"id": str(new_id), "already": False}


@router.delete("/watchlist/{item_id}")
def remove_watchlist(
    item_id: str,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    # Idempotent: removing an entry that's already gone still leaves the caller in
    # the desired state ("not on the watchlist"), so don't error.
    result = db.execute(text("DELETE FROM watchlist WHERE id = :id"), {"id": item_id})
    db.commit()
    return {"deleted": item_id, "found": result.rowcount > 0}


# ===========================================================================
# Interventions
# ===========================================================================
@router.get("/interventions")
def list_interventions(
    customer_no: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    conditions = ["1=1"]
    params: dict = {}
    if customer_no:
        conditions.append("customer_no = :cn")
        params["cn"] = customer_no
    if status:
        conditions.append("status = :st")
        params["st"] = status
    where = " AND ".join(conditions)

    try:
        rows = db.execute(text(f"""
            SELECT id, customer_no, account_no, action, status, outcome,
                   note, created_by_name, created_at, updated_at
            FROM interventions
            WHERE {where}
            ORDER BY created_at DESC
        """), params).fetchall()  # noqa: S608
    except Exception:
        return {"items": []}

    items = []
    for r in rows:
        items.append({
            "id": str(r[0]),
            "customer_no": r[1],
            "account_no": r[2],
            "action": r[3],
            "status": r[4],
            "outcome": r[5],
            "note": r[6],
            "created_by_name": r[7],
            "created_at": r[8].isoformat() if r[8] else None,
            "updated_at": r[9].isoformat() if r[9] else None,
        })
    return {"items": items}


@router.post("/interventions")
def create_intervention(
    body: InterventionCreate,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    new_id = uuid.uuid4()
    now = datetime.datetime.utcnow()
    db.execute(text("""
        INSERT INTO interventions
            (id, customer_no, account_no, action, status, outcome, note,
             created_by, created_by_name, created_at, updated_at)
        VALUES
            (:id, :cn, :an, :action, 'open', 'pending', :note,
             :by, :byname, :ts, :ts)
    """), {
        "id": new_id, "cn": body.customer_no, "an": body.account_no,
        "action": body.action, "note": body.note, "by": str(user.id),
        "byname": user.full_name or user.email, "ts": now,
    })
    db.commit()
    return {"id": str(new_id)}


@router.patch("/interventions/{item_id}")
def update_intervention(
    item_id: str,
    body: InterventionUpdate,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    sets = []
    params: dict = {"id": item_id, "ts": datetime.datetime.utcnow()}

    if body.status is not None:
        if body.status not in _VALID_STATUS:
            raise HTTPException(status_code=400, detail="Invalid status")
        sets.append("status = :status")
        params["status"] = body.status
    if body.outcome is not None:
        if body.outcome not in _VALID_OUTCOME:
            raise HTTPException(status_code=400, detail="Invalid outcome")
        sets.append("outcome = :outcome")
        params["outcome"] = body.outcome
    if body.note is not None:
        sets.append("note = :note")
        params["note"] = body.note

    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")

    sets.append("updated_at = :ts")
    result = db.execute(
        text(f"UPDATE interventions SET {', '.join(sets)} WHERE id = :id"),  # noqa: S608
        params,
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return {"updated": item_id}


@router.delete("/interventions/{item_id}")
def delete_intervention(
    item_id: str,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    result = db.execute(text("DELETE FROM interventions WHERE id = :id"), {"id": item_id})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return {"deleted": item_id}


@router.get("/interventions/stats")
def intervention_stats(
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    """Funnel counts for the workflow dashboard widget."""
    empty = {
        "total": 0,
        "by_status": {"open": 0, "in_progress": 0, "done": 0},
        "by_outcome": {"pending": 0, "retained": 0, "churned": 0},
        "success_rate": None,
    }
    try:
        status_rows = db.execute(
            text("SELECT status, COUNT(*) FROM interventions GROUP BY status")
        ).fetchall()
        outcome_rows = db.execute(
            text("SELECT outcome, COUNT(*) FROM interventions GROUP BY outcome")
        ).fetchall()
    except Exception:
        return empty

    by_status = dict(empty["by_status"])
    by_outcome = dict(empty["by_outcome"])
    for name, n in status_rows:
        if name in by_status:
            by_status[name] = int(n or 0)
    for name, n in outcome_rows:
        if name in by_outcome:
            by_outcome[name] = int(n or 0)

    total = sum(by_status.values())
    resolved = by_outcome["retained"] + by_outcome["churned"]
    success_rate = round(100.0 * by_outcome["retained"] / resolved, 1) if resolved else None

    return {
        "total": total,
        "by_status": by_status,
        "by_outcome": by_outcome,
        "success_rate": success_rate,
    }


# ===========================================================================
# Risk migration — derived from prediction_history snapshots
# ===========================================================================
@router.get("/risk-migration")
def risk_migration(
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    """
    For every customer with 2+ predictions in prediction_history, compare the
    earliest vs the latest risk_level and classify the movement.
    Requires customer_no to be present in customer_data (added in Phase 3).
    """
    empty = {
        "customers_tracked": 0,
        "improved": 0, "worsened": 0, "unchanged": 0,
        "transitions": [],
    }
    try:
        rows = db.execute(text("""
            SELECT
                customer_data->>'customer_no' AS customer_no,
                risk_level,
                churn_prob,
                created_at
            FROM prediction_history
            WHERE customer_data->>'customer_no' IS NOT NULL
              AND risk_level IS NOT NULL
            ORDER BY customer_data->>'customer_no', created_at
        """)).fetchall()
    except Exception:
        return empty

    # Group rows by customer_no (already ordered by created_at)
    by_customer: dict[str, list] = {}
    for cn, risk, prob, ts in rows:
        by_customer.setdefault(cn, []).append((risk, prob, ts))

    improved = worsened = unchanged = 0
    transitions: dict[str, int] = {}
    detail = []

    for cn, snaps in by_customer.items():
        if len(snaps) < 2:
            continue
        first_risk = snaps[0][0]
        last_risk = snaps[-1][0]
        r0 = _RISK_RANK.get(first_risk)
        r1 = _RISK_RANK.get(last_risk)
        if r0 is None or r1 is None:
            continue
        if r1 < r0:
            improved += 1
            direction = "improved"
        elif r1 > r0:
            worsened += 1
            direction = "worsened"
        else:
            unchanged += 1
            direction = "unchanged"

        key = f"{first_risk} → {last_risk}"
        transitions[key] = transitions.get(key, 0) + 1

        detail.append({
            "customer_no": cn,
            "from": first_risk,
            "to": last_risk,
            "direction": direction,
            "from_prob": float(snaps[0][1]) if snaps[0][1] is not None else None,
            "to_prob": float(snaps[-1][1]) if snaps[-1][1] is not None else None,
            "snapshots": len(snaps),
        })

    transition_list = [
        {"transition": k, "count": v}
        for k, v in sorted(transitions.items(), key=lambda x: -x[1])
    ]
    # Most-recently-worsened customers first for the detail table
    detail.sort(key=lambda d: (d["direction"] != "worsened", d["customer_no"]))

    return {
        "customers_tracked": improved + worsened + unchanged,
        "improved": improved,
        "worsened": worsened,
        "unchanged": unchanged,
        "transitions": transition_list,
        "detail": detail[:50],
    }
