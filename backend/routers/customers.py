from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from typing import Optional
from database import get_db
from services.auth_service import require_admin
from services.ml_service import generate_recommendations
from models.user import User

# Risk-segment labels treated as "high risk" (FR + EN variants)
_HIGH_RISK_LABELS = ("Élevé", "High", "high")

router = APIRouter(prefix="/customers", tags=["customers"])


# ---------------------------------------------------------------------------
# Allowed sort columns (whitelist to prevent SQL injection)
# ---------------------------------------------------------------------------
_ALLOWED_SORT = {
    "probabilite_churn",
    "acct_balance",
    "age",
    "tenure",
    "customer_no",
    "account_no",
    "churn",
    "churn_predit",
    "segment_risque",
}


def _build_search_query(
    q: Optional[str],
    risk_filter: Optional[str],
    churn_filter: Optional[int],
    sort_by: str,
    sort_dir: str,
    limit: int,
    offset: int,
    count_only: bool = False,
) -> tuple[str, dict]:
    """
    Build the JOIN query between clients_clean and churn_predictions.
    Returns (sql_string, params_dict).
    """
    select_cols = """
        c.customer_no,
        c.account_no,
        c.age,
        c.tenure,
        c.acct_balance,
        c.partyclass,
        c.nationality,
        c.residence,
        c.score_kyc,
        c.currency,
        c.marital_status,
        c.churn,
        p.churn_predit,
        p.probabilite_churn,
        p.segment_risque
    """

    base = """
        FROM clients_clean c
        LEFT JOIN churn_predictions p
               ON c.customer_no = p.customer_no
              AND c.account_no  = p.account_no
        WHERE 1=1
    """

    params: dict = {}
    conditions: list[str] = []

    if q:
        conditions.append("""
            (
                CAST(c.customer_no AS TEXT) ILIKE :q
                OR CAST(c.account_no  AS TEXT) ILIKE :q
                OR c.nationality ILIKE :q
                OR c.residence   ILIKE :q
                OR c.partyclass  ILIKE :q
            )
        """)
        params["q"] = f"%{q}%"

    if risk_filter:
        conditions.append("p.segment_risque = :risk_filter")
        params["risk_filter"] = risk_filter

    if churn_filter is not None:
        conditions.append("c.churn = :churn_filter")
        params["churn_filter"] = churn_filter

    where_extra = " AND ".join(conditions)
    if where_extra:
        base += " AND " + where_extra

    if count_only:
        sql = f"SELECT COUNT(*) {base}"
        return sql, params

    # Validate sort column
    safe_sort = sort_by if sort_by in _ALLOWED_SORT else "probabilite_churn"
    safe_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"

    sql = f"""
        SELECT {select_cols}
        {base}
        ORDER BY {safe_sort} {safe_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """
    params["limit"] = limit
    params["offset"] = offset

    return sql, params


def _row_to_dict(row) -> dict:
    keys = [
        "customer_no", "account_no", "age", "tenure", "acct_balance",
        "partyclass", "nationality", "residence", "score_kyc", "currency",
        "marital_status", "churn", "churn_predit", "probabilite_churn",
        "segment_risque",
    ]
    return {k: (float(v) if hasattr(v, "__float__") and v is not None else v)
            for k, v in zip(keys, row)}


# ---------------------------------------------------------------------------
# GET /customers/search
# ---------------------------------------------------------------------------
@router.get("/search")
def search_customers(
    q: Optional[str] = Query(default=None, description="Search term (customer_no, account_no, nationality, residence, partyclass)"),
    page: int = Query(default=0, ge=0),
    page_size: int = Query(default=20, ge=1, le=200),
    sort_by: str = Query(default="probabilite_churn"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    risk_filter: Optional[str] = Query(default=None, description="Filter by segment_risque value"),
    churn_filter: Optional[int] = Query(default=None, description="Filter by actual churn (0 or 1)"),
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    offset = page * page_size

    count_sql, count_params = _build_search_query(
        q, risk_filter, churn_filter, sort_by, sort_dir, page_size, offset, count_only=True
    )
    total: int = db.execute(text(count_sql), count_params).scalar() or 0

    data_sql, data_params = _build_search_query(
        q, risk_filter, churn_filter, sort_by, sort_dir, page_size, offset, count_only=False
    )
    rows = db.execute(text(data_sql), data_params).fetchall()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size if page_size else 1,
        "customers": [_row_to_dict(r) for r in rows],
    }


# ---------------------------------------------------------------------------
# GET /customers/options  – distinct dropdown values for Predict form
# ---------------------------------------------------------------------------
@router.get("/options")
def get_customer_options(
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    """Return distinct non-null values for nationality, residence, nature_client."""
    def distinct(col: str) -> list:
        try:
            rows = db.execute(
                text(f"SELECT DISTINCT {col} FROM clients_clean WHERE {col} IS NOT NULL ORDER BY {col}")  # noqa: S608
            ).fetchall()
            return [r[0] for r in rows if r[0]]
        except Exception:
            return []

    return {
        "nationalities": distinct("nationality"),
        "residences": distinct("residence"),
        "nature_clients": distinct("nature_client"),
        "account_categories": distinct("account_category"),
        "industries": distinct("industry"),
        "lobs": distinct("lob"),
        # Driven from real data so the Predict form's dropdowns match what's stored
        # (and so selecting a customer fills every field).
        "partyclasses": distinct("partyclass"),
        "currencies": distinct("currency"),
        "account_statuses": distinct("account_status"),
    }


# ---------------------------------------------------------------------------
# GET /customers/high-risk  – top high-risk customers (Dashboard table)
# ---------------------------------------------------------------------------
@router.get("/high-risk")
def high_risk_customers(
    limit: int = Query(default=10, ge=1, le=100),
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    """
    Return the top high-risk customers ordered by churn probability.
    Uses the FR/EN high-risk label variants so it catches every segment value.
    """
    placeholders = ", ".join(f":r{i}" for i in range(len(_HIGH_RISK_LABELS)))
    params: dict = {f"r{i}": label for i, label in enumerate(_HIGH_RISK_LABELS)}
    params["limit"] = limit

    sql = text(f"""
        SELECT
            c.customer_no,
            c.account_no,
            c.age,
            c.tenure,
            c.acct_balance,
            c.partyclass,
            c.nationality,
            c.residence,
            c.score_kyc,
            c.currency,
            c.marital_status,
            c.churn,
            p.churn_predit,
            p.probabilite_churn,
            p.segment_risque
        FROM clients_clean c
        JOIN churn_predictions p
              ON c.customer_no = p.customer_no
             AND c.account_no  = p.account_no
        WHERE p.segment_risque IN ({placeholders})
        ORDER BY p.probabilite_churn DESC NULLS LAST
        LIMIT :limit
    """)  # noqa: S608

    try:
        rows = db.execute(sql, params).fetchall()
    except Exception:
        return {"customers": []}

    return {"customers": [_row_to_dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# GET /customers/{customer_no}/recommendations  – rule-based retention actions
# ---------------------------------------------------------------------------
@router.get("/{customer_no}/recommendations")
def customer_recommendations(
    customer_no: str,
    account_no: Optional[str] = Query(default=None),
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    """
    Build rule-based retention recommendations for a single customer.
    Works WITHOUT the trained model: uses the stored probabilite_churn
    (if present) plus the customer's profile fields. Scoped to a specific
    account when given, else the highest-risk account (deterministic).
    """
    params: dict = {"customer_no": customer_no}
    account_filter = ""
    if account_no is not None and account_no != "":
        account_filter = "AND c.account_no = CAST(:account_no AS DOUBLE PRECISION)"
        params["account_no"] = account_no

    sql = text(f"""
        SELECT
            c.age,
            c.tenure,
            c.acct_balance,
            c.score_kyc,
            c.partyclass,
            c.currency,
            c.marital_status,
            p.probabilite_churn
        FROM clients_clean c
        LEFT JOIN churn_predictions p
               ON c.customer_no = p.customer_no
              AND c.account_no  = p.account_no
        WHERE CAST(c.customer_no AS TEXT) = :customer_no
        {account_filter}
        ORDER BY p.probabilite_churn DESC NULLS LAST
        LIMIT 1
    """)  # noqa: S608
    row = db.execute(sql, params).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    age, tenure, acct_balance, score_kyc, partyclass, currency, marital_status, prob = row

    input_data = {
        "age": age,
        "tenure": tenure,
        "acct_balance": acct_balance,
        "score_kyc": score_kyc,
        "partyclass": partyclass,
        "currency": currency,
        "marital_status": marital_status,
    }
    churn_prob = float(prob) if prob is not None else 0.0

    try:
        recommendations = generate_recommendations(
            input_data, {"churn_probability": churn_prob}
        )
    except Exception:
        recommendations = []

    return {
        "customer_no": customer_no,
        "churn_probability": churn_prob,
        "recommendations": recommendations,
    }


# ---------------------------------------------------------------------------
# GET /customers/{customer_no}/accounts  – all accounts held by a customer
# ---------------------------------------------------------------------------
@router.get("/{customer_no}/accounts")
def customer_accounts(
    customer_no: str,
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    """List every account for a customer with its own prediction, highest risk first.
    Powers the account switcher on the customer profile."""
    sql = text("""
        SELECT
            c.account_no,
            c.acct_balance,
            c.currency,
            p.probabilite_churn,
            p.segment_risque,
            p.churn_predit
        FROM clients_clean c
        LEFT JOIN churn_predictions p
               ON c.customer_no = p.customer_no
              AND c.account_no  = p.account_no
        WHERE CAST(c.customer_no AS TEXT) = :customer_no
        ORDER BY p.probabilite_churn DESC NULLS LAST
    """)
    rows = db.execute(sql, {"customer_no": customer_no}).fetchall()
    return {
        "accounts": [
            {
                "account_no": r[0],
                "acct_balance": r[1],
                "currency": r[2],
                "probabilite_churn": r[3],
                "segment_risque": r[4],
                "churn_predit": r[5],
            }
            for r in rows
        ]
    }


# ---------------------------------------------------------------------------
# GET /customers/{customer_no}  – full profile
# ---------------------------------------------------------------------------
@router.get("/{customer_no}")
def get_customer(
    customer_no: str,
    account_no: Optional[str] = Query(
        default=None,
        description="Specific account to load. A customer may hold several accounts, "
                    "each with its own churn prediction; when omitted the highest-risk "
                    "account is returned so the page is deterministic.",
    ),
    db=Depends(get_db),
    user: User = Depends(require_admin),
):
    params: dict = {"customer_no": customer_no}
    account_filter = ""
    if account_no is not None and account_no != "":
        # account_no is stored as double precision — match numerically so
        # "2011112859" and 2011112859.0 compare equal.
        account_filter = "AND c.account_no = CAST(:account_no AS DOUBLE PRECISION)"
        params["account_no"] = account_no

    sql = text(f"""
        SELECT
            c.*,
            p.churn_predit,
            p.probabilite_churn,
            p.segment_risque
        FROM clients_clean c
        LEFT JOIN churn_predictions p
               ON c.customer_no = p.customer_no
              AND c.account_no  = p.account_no
        WHERE CAST(c.customer_no AS TEXT) = :customer_no
        {account_filter}
        ORDER BY p.probabilite_churn DESC NULLS LAST
        LIMIT 1
    """)  # noqa: S608
    result = db.execute(sql, params)
    columns = list(result.keys())
    row = result.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Customer not found")

    return dict(zip(columns, row))
