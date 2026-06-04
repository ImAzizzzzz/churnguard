from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Any
from sqlalchemy import text
from database import get_db
from services.auth_service import require_admin
from services.ml_service import predict
from models.user import User, RoleEnum
from models.prediction_history import PredictionHistory
import datetime
import csv
import io
import uuid

router = APIRouter(prefix="/predict", tags=["prediction"])

_RISK_VARIANTS_EN = {
    'high':   ('high', 'High'),
    'High':   ('high', 'High'),
    'Élevé':  ('high', 'High'),
    'medium': ('medium', 'Medium'),
    'Medium': ('medium', 'Medium'),
    'Moyen':  ('medium', 'Medium'),
    'low':    ('low', 'Low'),
    'Low':    ('low', 'Low'),
    'Faible': ('low', 'Low'),
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class CustomerInput(BaseModel):
    customer_no: Optional[str] = None
    account_no: Optional[str] = None
    age: Optional[float] = None
    tenure: Optional[float] = None
    acct_balance: Optional[float] = None
    partyclass: Optional[str] = None
    industry: Optional[float] = None
    nationality: Optional[str] = None
    residence: Optional[str] = None
    marital_status: Optional[str] = None
    score_kyc: Optional[str] = None
    nature_client: Optional[str] = None
    lob: Optional[float] = None
    currency: Optional[str] = None
    account_status: Optional[str] = None
    account_category: Optional[float] = None
    accountnature: Optional[str] = None


class PredictionResult(BaseModel):
    churn_probability: float
    risk_level: str
    confidence: str
    shap_contributions: dict
    demo: bool
    recommendations: list[dict[str, Any]] = []


# ---------------------------------------------------------------------------
# POST /predict/  — run ML inference + save to history
# ---------------------------------------------------------------------------
@router.post("/", response_model=PredictionResult)
def predict_churn(
    data: CustomerInput,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    result = predict(data.model_dump(exclude_none=False))

    # Fire-and-forget history save — never fail the prediction
    try:
        record = PredictionHistory(
            id=uuid.uuid4(),
            customer_no=data.customer_no,
            admin_id=str(user.id),
            admin_name=user.full_name or user.email,
            customer_data=data.dict(),
            churn_prob=result.get("churn_probability"),
            risk_level=result.get("risk_level"),
            confidence=result.get("confidence"),
            shap_json=result.get("shap_contributions"),
            created_at=datetime.datetime.utcnow(),
        )
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()

    return result


# ---------------------------------------------------------------------------
# GET /predict/history  — paginated list with filters
# ---------------------------------------------------------------------------
@router.get("/history")
def list_history(
    page: int = Query(default=0, ge=0),
    page_size: int = Query(default=20, ge=1, le=5000),
    risk_level: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None, description="ISO date YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="ISO date YYYY-MM-DD"),
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    conditions = ["1=1"]
    params: dict = {}

    if risk_level:
        variants = _RISK_VARIANTS_EN.get(risk_level, (risk_level,))
        ph = ", ".join(f":rl{i}" for i in range(len(variants)))
        conditions.append(f"risk_level IN ({ph})")
        params.update({f"rl{i}": v for i, v in enumerate(variants)})
    if date_from:
        conditions.append("created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("created_at < :date_to_exclusive")
        params["date_to_exclusive"] = date_to + " 23:59:59"

    where = " AND ".join(conditions)

    total = db.execute(
        text(f"SELECT COUNT(*) FROM prediction_history WHERE {where}"),
        params,
    ).scalar() or 0

    offset = page * page_size
    rows = db.execute(
        text(
            f"SELECT id, admin_id, admin_name, customer_data, churn_prob, "
            f"risk_level, confidence, shap_json, created_at "
            f"FROM prediction_history WHERE {where} "
            f"ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        ),
        {**params, "limit": page_size, "offset": offset},
    ).fetchall()

    items = []
    for r in rows:
        items.append({
            "id": str(r[0]),
            "admin_id": r[1],
            "admin_name": r[2],
            "customer_data": r[3],
            "churn_prob": r[4],
            "risk_level": r[5],
            "confidence": r[6],
            "shap_json": r[7],
            "created_at": r[8].isoformat() if r[8] else None,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if page_size else 1,
        "items": items,
    }


# ---------------------------------------------------------------------------
# GET /predict/history/export-csv
# ---------------------------------------------------------------------------
@router.get("/history/export-csv")
def export_history_csv(
    risk_level: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    conditions = ["1=1"]
    params: dict = {}

    if risk_level:
        variants = _RISK_VARIANTS_EN.get(risk_level, (risk_level,))
        ph = ", ".join(f":rl{i}" for i in range(len(variants)))
        conditions.append(f"risk_level IN ({ph})")
        params.update({f"rl{i}": v for i, v in enumerate(variants)})
    if date_from:
        conditions.append("created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("created_at < :date_to_exclusive")
        params["date_to_exclusive"] = date_to + " 23:59:59"

    where = " AND ".join(conditions)
    rows = db.execute(
        text(
            f"SELECT id, admin_name, customer_data, churn_prob, risk_level, confidence, created_at "
            f"FROM prediction_history WHERE {where} ORDER BY created_at DESC"
        ),
        params,
    ).fetchall()

    _LABEL = {'high': 'High', 'High': 'High', 'medium': 'Medium', 'Medium': 'Medium',
              'low': 'Low', 'Low': 'Low', 'Élevé': 'High', 'Moyen': 'Medium', 'Faible': 'Low'}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Customer No", "Churn Probability (%)", "Risk Level",
                     "Confidence", "Predicted By", "Date"])
    for r in rows:
        customer_no = (r[2] or {}).get("customer_no", "") if isinstance(r[2], dict) else ""
        prob = float(r[3]) if r[3] is not None else None
        created = r[6]
        writer.writerow([
            customer_no,
            round(prob * 100, 1) if prob is not None else "",
            _LABEL.get(r[4], r[4] or ""),
            r[5],
            r[1],
            created.strftime("%Y-%m-%d %H:%M:%S") if hasattr(created, "strftime") else (created or ""),
        ])

    output.seek(0)
    # UTF-8 with BOM so Excel renders correctly.
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=prediction_history.csv"},
    )


# ---------------------------------------------------------------------------
# DELETE /predict/history/{item_id}  — super_admin only
# ---------------------------------------------------------------------------
@router.delete("/history/{item_id}")
def delete_history_item(
    item_id: str,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    if user.role != RoleEnum.super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")

    result = db.execute(
        text("DELETE FROM prediction_history WHERE id = :id"),
        {"id": item_id},
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="History record not found")

    return {"deleted": item_id}
