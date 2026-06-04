from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from database import SessionLocal
from services.auth_service import require_admin
from services.ml_service import predict as ml_predict
from models.user import User
from typing import Optional
import csv, io

router = APIRouter(prefix="/reports", tags=["reports"])

_RISK_VARIANTS = {
    'high':   ('Élevé', 'High', 'high'),
    'High':   ('Élevé', 'High', 'high'),
    'Élevé':  ('Élevé', 'High', 'high'),
    'medium': ('Moyen', 'Medium', 'medium'),
    'Medium': ('Moyen', 'Medium', 'medium'),
    'Moyen':  ('Moyen', 'Medium', 'medium'),
    'low':    ('Faible', 'Low', 'low'),
    'Low':    ('Faible', 'Low', 'low'),
    'Faible': ('Faible', 'Low', 'low'),
}

# DB stores risk segments in French — map to the English labels shown in the UI.
_RISK_LABEL_EN = {
    'Élevé': 'High', 'High': 'High', 'high': 'High',
    'Moyen': 'Medium', 'Medium': 'Medium', 'medium': 'Medium',
    'Faible': 'Low', 'Low': 'Low', 'low': 'Low',
}


def _clean_account(v):
    """account_no is stored as double precision (e.g. 2.0119e9) — show it as a plain integer."""
    if v is None:
        return ""
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return str(v)


def _csv_response(buf: io.StringIO, filename: str) -> StreamingResponse:
    """UTF-8 *with BOM* so Excel (esp. on Windows) renders accents correctly."""
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode("utf-8-sig")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/predictions")
def list_predictions(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    risk: Optional[str] = None,
    db=Depends(get_db_session),
    user: User = Depends(require_admin),
):
    conditions = ["1=1"]
    params: dict = {"limit": limit, "offset": offset}

    if risk:
        variants = _RISK_VARIANTS.get(risk, (risk,))
        ph = ", ".join(f":r{i}" for i in range(len(variants)))
        conditions.append(f"segment_risque IN ({ph})")
        params.update({f"r{i}": v for i, v in enumerate(variants)})

    where = " AND ".join(conditions)

    rows = db.execute(text(f"""
        SELECT customer_no, account_no, churn_reel, churn_predit,
               probabilite_churn, segment_risque
        FROM churn_predictions
        WHERE {where}
        ORDER BY probabilite_churn DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    count_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
    total = db.execute(text(f"""
        SELECT COUNT(*) FROM churn_predictions
        WHERE {where}
    """), count_params).scalar()

    return {
        "total": total,
        "data": [
            {
                "customer_no": r[0],
                "account_no": r[1],
                "churn_reel": r[2],
                "churn_predit": r[3],
                "probabilite_churn": round(float(r[4]), 3) if r[4] is not None else None,
                "segment_risque": r[5],
            }
            for r in rows
        ],
    }


@router.get("/export-csv")
def export_csv(
    risk: Optional[str] = None,
    db=Depends(get_db_session),
    user: User = Depends(require_admin),
):
    conditions = ["1=1"]
    params: dict = {}

    if risk:
        variants = _RISK_VARIANTS.get(risk, (risk,))
        ph = ", ".join(f":r{i}" for i in range(len(variants)))
        conditions.append(f"segment_risque IN ({ph})")
        params.update({f"r{i}": v for i, v in enumerate(variants)})

    where = " AND ".join(conditions)

    rows = db.execute(text(f"""
        SELECT customer_no, account_no, churn_reel, churn_predit,
               probabilite_churn, segment_risque
        FROM churn_predictions
        WHERE {where}
        ORDER BY probabilite_churn DESC NULLS LAST
    """), params).fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf)
    # Mirror the on-screen Batch Results table: readable labels, not raw codes.
    writer.writerow(["Customer No", "Account No", "Churn Risk (%)",
                     "Risk Level", "Actual", "Predicted"])
    for r in rows:
        prob = float(r[4]) if r[4] is not None else None
        writer.writerow([
            r[0],
            _clean_account(r[1]),
            round(prob * 100, 1) if prob is not None else "",
            _RISK_LABEL_EN.get(r[5], r[5] or ""),
            "Churned" if r[2] == 1 else ("Retained" if r[2] == 0 else ""),
            "Churn" if r[3] == 1 else ("Stay" if r[3] == 0 else ""),
        ])

    buf.seek(0)
    return _csv_response(buf, "churn_predictions.csv")


@router.post("/batch-predict")
async def batch_predict(
    file: UploadFile = File(...),
    user: User = Depends(require_admin),
):
    content = await file.read()
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    except Exception:
        reader = csv.DictReader(io.StringIO(content.decode("latin-1")))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["customer_no", "account_no", "churn_probability", "risk_level", "confidence"])

    for row in reader:
        input_data = {}
        for k, v in row.items():
            if v is None or v.strip() == "":
                input_data[k] = None
            else:
                try:
                    input_data[k] = float(v)
                except ValueError:
                    input_data[k] = v.strip()

        result = ml_predict(input_data)
        writer.writerow([
            row.get("customer_no", ""),
            row.get("account_no", ""),
            result["churn_probability"],
            result["risk_level"],
            result["confidence"],
        ])

    buf.seek(0)
    return _csv_response(buf, "batch_predictions.csv")
