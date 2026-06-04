"""
Data Upload API
---------------
POST  /upload/dataset   — preview a CSV/XLSX upload (super_admin only)
POST  /upload/confirm   — commit a previewed upload to the DB
GET   /upload/history   — list recent upload sessions
"""

from __future__ import annotations

import io
import json
import uuid
import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from database import get_db
from services.auth_service import require_super_admin
from models.user import User

router = APIRouter(prefix="/upload", tags=["upload"])

# ---------------------------------------------------------------------------
# In-memory session store (keyed by session_token). Bounded by TTL + max count
# so a long-running process can't leak memory. For multi-worker/production,
# swap this for Redis or a DB table.
# ---------------------------------------------------------------------------
_upload_sessions: dict[str, dict] = {}
_SESSION_TTL_SECONDS = 30 * 60   # forget previews after 30 minutes
_MAX_SESSIONS = 50               # hard cap on retained sessions

# Max rows to import in one go
_MAX_ROWS = 50_000


def _evict_stale_sessions() -> None:
    """Drop sessions past their TTL, then enforce the count cap (oldest first)."""
    now = datetime.datetime.utcnow()
    stale = []
    for token, s in _upload_sessions.items():
        try:
            ts = datetime.datetime.fromisoformat(s.get("uploaded_at"))
        except (TypeError, ValueError):
            ts = now
        if (now - ts).total_seconds() > _SESSION_TTL_SECONDS:
            stale.append(token)
    for token in stale:
        _upload_sessions.pop(token, None)

    if len(_upload_sessions) > _MAX_SESSIONS:
        ordered = sorted(_upload_sessions.items(), key=lambda kv: kv[1].get("uploaded_at") or "")
        for token, _ in ordered[: len(_upload_sessions) - _MAX_SESSIONS]:
            _upload_sessions.pop(token, None)


# ---------------------------------------------------------------------------
# Column name normalisation
# ---------------------------------------------------------------------------

# Maps common variant names → canonical column name
_COLUMN_ALIASES: dict[str, str] = {
    # customer / account identifiers
    "customerNo": "customer_no",
    "customer no": "customer_no",
    "customerno": "customer_no",
    "accountNo": "account_no",
    "account no": "account_no",
    "accountno": "account_no",
    # balance variants
    "balance": "acct_balance",
    "account_balance": "acct_balance",
    "acctbalance": "acct_balance",
    # churn variants
    "churn_actual": "churn",
    "actual_churn": "churn",
    # prediction variants
    "churn_predicted": "churn_predit",
    "predicted_churn": "churn_predit",
    "churnpredit": "churn_predit",
    # probability variants
    "churn_probability": "probabilite_churn",
    "probability_churn": "probabilite_churn",
    "prob_churn": "probabilite_churn",
    "churnprobability": "probabilite_churn",
    # risk segment
    "risk_segment": "segment_risque",
    "segment_risk": "segment_risque",
    "risksegment": "segment_risque",
}

_REQUIRED_COLUMNS = {
    "customer_no",
    "account_no",
    "acct_balance",
    "age",
    "tenure",
    "churn",
    "churn_predit",
    "probabilite_churn",
    "segment_risque",
}


def _normalise_columns(df) -> tuple[Any, list[str]]:
    """Lower-strip column names and apply alias mapping. Returns (df, errors)."""
    import pandas as pd

    rename_map: dict[str, str] = {}
    for col in df.columns:
        stripped = col.strip()
        lower = stripped.lower()
        # Direct alias lookup
        canonical = _COLUMN_ALIASES.get(stripped) or _COLUMN_ALIASES.get(lower)
        if canonical:
            rename_map[col] = canonical
        elif stripped != col:
            rename_map[col] = stripped

    df = df.rename(columns=rename_map)

    missing = _REQUIRED_COLUMNS - set(df.columns)
    errors = [f"Missing required column: '{c}'" for c in sorted(missing)]
    return df, errors


# ---------------------------------------------------------------------------
# POST /upload/dataset — parse, validate, return preview
# ---------------------------------------------------------------------------
@router.post("/dataset")
async def upload_dataset(
    file: UploadFile = File(...),
    user: User = Depends(require_super_admin),
):
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="pandas is not installed. Run: pip install pandas openpyxl",
        )

    _evict_stale_sessions()
    filename = file.filename or ""
    content = await file.read()

    # Parse
    try:
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Upload a .csv or .xlsx file.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}")

    if len(df) > _MAX_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"File has {len(df):,} rows; maximum allowed is {_MAX_ROWS:,}.",
        )

    df, validation_errors = _normalise_columns(df)

    # Replace NaN with None for JSON serialisation
    preview_df = df.head(10).where(pd.notnull(df.head(10)), None)
    preview_rows = preview_df.to_dict(orient="records")

    # Generate a session token so the caller can confirm later
    session_token = str(uuid.uuid4())
    _upload_sessions[session_token] = {
        "filename": filename,
        "uploaded_by": str(user.id),
        "uploaded_at": datetime.datetime.utcnow().isoformat(),
        "row_count": len(df),
        "columns": list(df.columns),
        "validation_errors": validation_errors,
        # Store serialised data only if valid
        "data_json": df.to_json(orient="records") if not validation_errors else None,
    }

    return {
        "session_token": session_token,
        "filename": filename,
        "row_count": len(df),
        "columns": list(df.columns),
        "preview": preview_rows,
        "validation_errors": validation_errors,
        "ready_to_import": len(validation_errors) == 0,
    }


# ---------------------------------------------------------------------------
# POST /upload/confirm — commit to DB
# ---------------------------------------------------------------------------
@router.post("/confirm")
def confirm_upload(
    session_token: str = Form(...),
    db=Depends(get_db),
    user: User = Depends(require_super_admin),
):
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(status_code=500, detail="pandas is not installed.")

    session = _upload_sessions.get(session_token)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found or expired.")

    if session["validation_errors"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot import — validation errors exist.",
                "errors": session["validation_errors"],
            },
        )

    if not session.get("data_json"):
        raise HTTPException(status_code=400, detail="No data available for this session.")

    df = pd.read_json(io.StringIO(session["data_json"]), orient="records")

    inserted = 0
    updated = 0
    errors: list[str] = []

    upsert_sql = text("""
        INSERT INTO churn_predictions
            (customer_no, account_no, churn_reel, churn_predit, probabilite_churn, segment_risque)
        VALUES
            (:customer_no, :account_no, :churn, :churn_predit, :probabilite_churn, :segment_risque)
        ON CONFLICT (customer_no, account_no)
        DO UPDATE SET
            churn_reel        = EXCLUDED.churn_reel,
            churn_predit      = EXCLUDED.churn_predit,
            probabilite_churn = EXCLUDED.probabilite_churn,
            segment_risque    = EXCLUDED.segment_risque
    """)

    for i, row in df.iterrows():
        try:
            params = {
                "customer_no": row.get("customer_no"),
                "account_no": row.get("account_no"),
                "churn": int(row["churn"]) if pd.notna(row.get("churn")) else None,
                "churn_predit": int(row["churn_predit"]) if pd.notna(row.get("churn_predit")) else None,
                "probabilite_churn": float(row["probabilite_churn"]) if pd.notna(row.get("probabilite_churn")) else None,
                "segment_risque": str(row["segment_risque"]) if pd.notna(row.get("segment_risque")) else None,
            }
            result = db.execute(upsert_sql, params)
            # rowcount 1 = insert, but PostgreSQL ON CONFLICT UPDATE also returns 1
            inserted += 1
        except Exception as exc:
            errors.append(f"Row {i}: {exc}")
            if len(errors) > 20:
                errors.append("Too many errors — aborting.")
                db.rollback()
                raise HTTPException(
                    status_code=500,
                    detail={"message": "Import aborted due to too many errors.", "errors": errors},
                )

    db.commit()

    # Record in history
    _upload_sessions[session_token]["imported"] = True
    _upload_sessions[session_token]["import_count"] = inserted
    _upload_sessions[session_token]["import_errors"] = errors

    # Remove data payload to free memory
    _upload_sessions[session_token]["data_json"] = None

    return {
        "message": f"Import complete: {inserted} rows processed.",
        "row_count": inserted,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# GET /upload/history — list recent upload sessions
# ---------------------------------------------------------------------------
@router.get("/history")
def upload_history(
    user: User = Depends(require_super_admin),
):
    history = []
    for token, session in _upload_sessions.items():
        history.append({
            "session_token": token,
            "filename": session.get("filename"),
            "uploaded_by": session.get("uploaded_by"),
            "uploaded_at": session.get("uploaded_at"),
            "row_count": session.get("row_count"),
            "columns": session.get("columns"),
            "validation_errors": session.get("validation_errors", []),
            "imported": session.get("imported", False),
            "import_count": session.get("import_count"),
        })

    # Most recent first
    history.sort(key=lambda x: x.get("uploaded_at") or "", reverse=True)
    return history
