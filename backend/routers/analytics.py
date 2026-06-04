from fastapi import APIRouter, Depends
from sqlalchemy import text
from database import SessionLocal
from services.auth_service import require_admin
from models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def query(db, sql):
    return db.execute(text(sql)).fetchall()

@router.get("/kpis")
def get_kpis(db=Depends(get_db_session), user: User = Depends(require_admin)):
    total = query(db, "SELECT COUNT(*) FROM clients_clean")[0][0]
    churned = query(db, "SELECT COUNT(*) FROM clients_clean WHERE churn = 1")[0][0]
    avg_balance = query(db, "SELECT ROUND(AVG(acct_balance)::numeric, 2) FROM clients_clean")[0][0]
    high_risk = query(db, "SELECT COUNT(*) FROM churn_predictions WHERE segment_risque IN ('Élevé', 'High', 'high')")[0][0]
    predicted_churn = query(db, "SELECT COUNT(*) FROM churn_predictions WHERE churn_predit = 1")[0][0]
    avg_tenure = query(db, "SELECT ROUND(AVG(tenure)::numeric, 1) FROM clients_clean")[0][0]
    avg_age = query(db, "SELECT ROUND(AVG(age)::numeric, 0) FROM clients_clean")[0][0]

    return {
        "total_customers": total,
        "churn_rate": round((churned / total * 100), 1) if total else 0,
        "avg_balance": float(avg_balance or 0),
        "high_risk_customers": high_risk,
        "predicted_churners": predicted_churn,
        "avg_tenure": float(avg_tenure or 0),
        "avg_age": float(avg_age or 0),
    }

@router.get("/churn-by-partyclass")
def churn_by_partyclass(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT partyclass,
               COUNT(*) as total,
               SUM(churn) as churned,
               ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE partyclass IS NOT NULL
        GROUP BY partyclass ORDER BY churn_rate DESC
    """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-industry")
def churn_by_industry(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT industry,
               COUNT(*) as total,
               SUM(churn) as churned,
               ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE industry IS NOT NULL
        GROUP BY industry ORDER BY churn_rate DESC LIMIT 10
    """)
    return [{"name": str(r[0]), "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-age")
def churn_by_age(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT
            CASE
                WHEN age < 25 THEN '< 25'
                WHEN age < 35 THEN '25-34'
                WHEN age < 45 THEN '35-44'
                WHEN age < 55 THEN '45-54'
                WHEN age < 65 THEN '55-64'
                ELSE '65+'
            END as age_group,
            COUNT(*) as total,
            SUM(churn) as churned,
            ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE age IS NOT NULL
        GROUP BY age_group
        ORDER BY MIN(age)
    """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-tenure")
def churn_by_tenure(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT
            CASE
                WHEN tenure < 1 THEN '< 1 yr'
                WHEN tenure < 3 THEN '1-2 yrs'
                WHEN tenure < 5 THEN '3-4 yrs'
                WHEN tenure < 8 THEN '5-7 yrs'
                ELSE '8+ yrs'
            END as tenure_group,
            COUNT(*) as total,
            SUM(churn) as churned,
            ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE tenure IS NOT NULL
        GROUP BY tenure_group
        ORDER BY MIN(tenure)
    """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-balance")
def churn_by_balance(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT
            CASE
                WHEN acct_balance < 5000 THEN '< 5K'
                WHEN acct_balance < 20000 THEN '5K-20K'
                WHEN acct_balance < 50000 THEN '20K-50K'
                WHEN acct_balance < 100000 THEN '50K-100K'
                ELSE '100K+'
            END as balance_group,
            COUNT(*) as total,
            SUM(churn) as churned,
            ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE acct_balance IS NOT NULL
        GROUP BY balance_group
        ORDER BY MIN(acct_balance)
    """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-marital")
def churn_by_marital(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT marital_status,
               COUNT(*) as total,
               SUM(churn) as churned,
               ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE marital_status IS NOT NULL
        GROUP BY marital_status ORDER BY churn_rate DESC
    """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-nationality")
def churn_by_nationality(db=Depends(get_db_session), user: User = Depends(require_admin)):
    # Try nationality_grouped first (derived column), fall back to nationality
    try:
        rows = query(db, """
            SELECT nationality_grouped,
                   COUNT(*) as total,
                   SUM(churn) as churned,
                   ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
            FROM clients_clean
            WHERE nationality_grouped IS NOT NULL
            GROUP BY nationality_grouped ORDER BY churn_rate DESC LIMIT 8
        """)
    except Exception:
        rows = query(db, """
            SELECT nationality,
                   COUNT(*) as total,
                   SUM(churn) as churned,
                   ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
            FROM clients_clean
            WHERE nationality IS NOT NULL
            GROUP BY nationality ORDER BY churn_rate DESC LIMIT 8
        """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-residence")
def churn_by_residence(db=Depends(get_db_session), user: User = Depends(require_admin)):
    # Try residence_grouped first (derived column), fall back to residence
    try:
        rows = query(db, """
            SELECT residence_grouped,
                   COUNT(*) as total,
                   SUM(churn) as churned,
                   ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
            FROM clients_clean
            WHERE residence_grouped IS NOT NULL
            GROUP BY residence_grouped ORDER BY churn_rate DESC LIMIT 8
        """)
    except Exception:
        rows = query(db, """
            SELECT residence,
                   COUNT(*) as total,
                   SUM(churn) as churned,
                   ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
            FROM clients_clean
            WHERE residence IS NOT NULL
            GROUP BY residence ORDER BY churn_rate DESC LIMIT 8
        """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/account-status")
def account_status_breakdown(db=Depends(get_db_session), user: User = Depends(require_admin)):
    """Active / closed / dormant account breakdown for a pie chart."""
    try:
        rows = query(db, """
            SELECT account_status, COUNT(*) as total
            FROM clients_clean
            WHERE account_status IS NOT NULL
            GROUP BY account_status ORDER BY total DESC
        """)
        return [{"name": str(r[0]), "value": r[1]} for r in rows]
    except Exception:
        return []


@router.get("/risk-segments")
def risk_segments(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT segment_risque, COUNT(*) as total
        FROM churn_predictions
        WHERE segment_risque IS NOT NULL
        GROUP BY segment_risque ORDER BY total DESC
    """)
    return [{"name": r[0], "value": r[1]} for r in rows]

@router.get("/actual-vs-predicted")
def actual_vs_predicted(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT
            SUM(CASE WHEN churn_reel = 1 AND churn_predit = 1 THEN 1 ELSE 0 END) as true_positive,
            SUM(CASE WHEN churn_reel = 0 AND churn_predit = 0 THEN 1 ELSE 0 END) as true_negative,
            SUM(CASE WHEN churn_reel = 0 AND churn_predit = 1 THEN 1 ELSE 0 END) as false_positive,
            SUM(CASE WHEN churn_reel = 1 AND churn_predit = 0 THEN 1 ELSE 0 END) as false_negative
        FROM churn_predictions
    """)
    r = rows[0]
    return {
        "true_positive": r[0], "true_negative": r[1],
        "false_positive": r[2], "false_negative": r[3]
    }

@router.get("/probability-distribution")
def probability_distribution(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT
            CASE
                WHEN probabilite_churn < 0.1 THEN '0.0-0.1'
                WHEN probabilite_churn < 0.2 THEN '0.1-0.2'
                WHEN probabilite_churn < 0.3 THEN '0.2-0.3'
                WHEN probabilite_churn < 0.4 THEN '0.3-0.4'
                WHEN probabilite_churn < 0.5 THEN '0.4-0.5'
                WHEN probabilite_churn < 0.6 THEN '0.5-0.6'
                WHEN probabilite_churn < 0.7 THEN '0.6-0.7'
                WHEN probabilite_churn < 0.8 THEN '0.7-0.8'
                WHEN probabilite_churn < 0.9 THEN '0.8-0.9'
                ELSE '0.9-1.0'
            END as bucket,
            COUNT(*) as total
        FROM churn_predictions
        WHERE probabilite_churn IS NOT NULL
        GROUP BY bucket ORDER BY bucket
    """)
    return [{"name": r[0], "count": r[1]} for r in rows]

@router.get("/churn-by-kyc")
def churn_by_kyc(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT score_kyc,
               COUNT(*) as total,
               SUM(churn) as churned,
               ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE score_kyc IS NOT NULL
        GROUP BY score_kyc ORDER BY churn_rate DESC
    """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]

@router.get("/churn-by-currency")
def churn_by_currency(db=Depends(get_db_session), user: User = Depends(require_admin)):
    rows = query(db, """
        SELECT currency,
               COUNT(*) as total,
               SUM(churn) as churned,
               ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
        FROM clients_clean
        WHERE currency IS NOT NULL
        GROUP BY currency ORDER BY churn_rate DESC
    """)
    return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]


@router.get("/churn-by-nature-client")
def churn_by_nature_client(db=Depends(get_db_session), user: User = Depends(require_admin)):
    try:
        rows = query(db, """
            SELECT nature_client,
                   COUNT(*) as total,
                   SUM(churn) as churned,
                   ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
            FROM clients_clean
            WHERE nature_client IS NOT NULL
            GROUP BY nature_client ORDER BY churn_rate DESC
        """)
        return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]
    except Exception:
        return []


@router.get("/churn-by-account-category")
def churn_by_account_category(db=Depends(get_db_session), user: User = Depends(require_admin)):
    try:
        rows = query(db, """
            SELECT account_category,
                   COUNT(*) as total,
                   SUM(churn) as churned,
                   ROUND(100.0 * SUM(churn) / COUNT(*), 1) as churn_rate
            FROM clients_clean
            WHERE account_category IS NOT NULL
            GROUP BY account_category ORDER BY churn_rate DESC
        """)
        return [{"name": r[0], "total": r[1], "churned": r[2], "churn_rate": float(r[3])} for r in rows]
    except Exception:
        return []


# Risk segment values considered "high risk" across FR/EN labellings
_HIGH_RISK_KEYS = {"Élevé", "High", "high"}
_RISK_ORDER = {
    "Élevé": 0, "High": 0, "high": 0,
    "Moyen": 1, "Medium": 1, "medium": 1,
    "Faible": 2, "Low": 2, "low": 2,
}


@router.get("/revenue-at-risk")
def revenue_at_risk(db=Depends(get_db_session), user: User = Depends(require_admin)):
    """
    Total account balance exposed in each predicted risk segment.

    Executive view: shows *money at risk*, not just customer counts, by
    joining predicted risk (churn_predictions.segment_risque) with the
    customer's balance (clients_clean.acct_balance).
    """
    empty = {
        "segments": [], "total_at_risk": 0, "at_risk_customers": 0,
        "total_balance": 0, "currency": "TND",
    }
    try:
        rows = query(db, """
            SELECT p.segment_risque,
                   COUNT(*) AS customers,
                   COALESCE(SUM(c.acct_balance), 0) AS balance
            FROM clients_clean c
            JOIN churn_predictions p
              ON c.customer_no = p.customer_no
             AND c.account_no  = p.account_no
            WHERE p.segment_risque IS NOT NULL
            GROUP BY p.segment_risque
        """)
    except Exception:
        return empty

    segments, total_at_risk, at_risk_customers, total_balance = [], 0.0, 0, 0.0
    for r in rows:
        name = r[0]
        customers = int(r[1] or 0)
        balance = float(r[2] or 0)
        segments.append({"name": name, "customers": customers, "balance": round(balance, 2)})
        total_balance += balance
        if name in _HIGH_RISK_KEYS:
            total_at_risk += balance
            at_risk_customers += customers

    segments.sort(key=lambda s: _RISK_ORDER.get(s["name"], 9))
    return {
        "segments": segments,
        "total_at_risk": round(total_at_risk, 2),
        "at_risk_customers": at_risk_customers,
        "total_balance": round(total_balance, 2),
        "currency": "TND",
    }


@router.get("/churn-trend")
def churn_trend(db=Depends(get_db_session), user: User = Depends(require_admin)):
    """
    Churn-risk trend over time, derived from in-app prediction history
    (prediction_history.created_at) — the only time-stamped data available
    until a dated customer dataset is loaded. Returns one point per day.
    """
    try:
        rows = query(db, """
            SELECT DATE(created_at) AS day,
                   COUNT(*) AS n,
                   ROUND(AVG(churn_prob)::numeric, 4) AS avg_prob,
                   SUM(CASE WHEN LOWER(risk_level) IN ('high', 'élevé') THEN 1 ELSE 0 END) AS high_n
            FROM prediction_history
            WHERE created_at IS NOT NULL
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        """)
    except Exception:
        return []

    out = []
    for r in rows:
        day = r[0]
        n = int(r[1] or 0)
        avg_prob = float(r[2] or 0)
        high_n = int(r[3] or 0)
        out.append({
            "date": day.isoformat() if hasattr(day, "isoformat") else str(day),
            "predictions": n,
            "avg_churn_prob": round(avg_prob * 100, 1),
            "high_risk": high_n,
            "high_risk_rate": round(100.0 * high_n / n, 1) if n else 0,
        })
    return out