import joblib
import json
import numpy as np
import pandas as pd
import os

_ML_DIR = os.path.join(os.path.dirname(__file__), "../ml")
MODEL_PATH      = os.path.join(_ML_DIR, "model.joblib")
SCALER_PATH     = os.path.join(_ML_DIR, "scaler.joblib")
ENCODED_COLS    = os.path.join(_ML_DIR, "encoded_columns.json")
SELECTED_FEATS  = os.path.join(_ML_DIR, "selected_features.json")
SCALED_COLS     = os.path.join(_ML_DIR, "scaled_columns.json")

model = None
scaler = None
encoded_columns = []        # full one-hot feature columns (before selection)
selected_features = []      # the 30 features the model was trained on
model_feature_names = []    # whatever feature_names_in_ the loaded model carries
scaled_columns = ["AGE", "TENURE", "ACCT_BALANCE", "SCORE_KYC"]  # MinMax order

# ── Preprocessing constants (must match the training notebooks) ────────────
KYC_ORDINAL = {"LR": 1, "MR": 2, "H1": 3, "H2": 4, "H3": 5}
# Categorical columns one-hot encoded during training (SCORE_KYC is numeric/ordinal)
CAT_COLS = [
    "LOB", "INDUSTRY", "NATIONALITY", "RESIDENCE", "PARTYCLASS", "BRANCH",
    "NATURE_CLIENT", "MARITAL_STATUS", "ACCOUNT_CATEGORY", "CURRENCY", "ACCOUNTNATURE",
]

# Human-readable labels for SHAP feature display
_NUM_LABELS = {
    "AGE": "Age", "TENURE": "Tenure", "ACCT_BALANCE": "Account balance",
    "SCORE_KYC": "KYC score",
}
_COL_LABELS = {
    "LOB": "Line of business", "INDUSTRY": "Industry", "NATIONALITY": "Nationality",
    "RESIDENCE": "Residence", "PARTYCLASS": "Segment", "BRANCH": "Branch",
    "NATURE_CLIENT": "Client nature", "MARITAL_STATUS": "Marital status",
    "ACCOUNT_CATEGORY": "Account category", "CURRENCY": "Currency",
    "ACCOUNTNATURE": "Account nature",
}
# Longest prefixes first so e.g. ACCOUNT_CATEGORY matches before any shorter key
_COL_PREFIXES = sorted(_COL_LABELS.keys(), key=len, reverse=True)


def _pretty_feature(name: str) -> str:
    """Turn an encoded feature name into a readable label for SHAP display.
    e.g. 'TENURE' → 'Tenure'; 'ACCOUNTNATURE_Comptes...' → 'Account nature: Comptes...';
    'ACCOUNT_CATEGORY_6001.0' → 'Account category: 6001'."""
    if name in _NUM_LABELS:
        return _NUM_LABELS[name]
    for p in _COL_PREFIXES:
        if name.startswith(p + "_"):
            val = name[len(p) + 1:]
            if val.endswith(".0"):
                val = val[:-2]
            if len(val) > 28:
                val = val[:27] + "…"
            return f"{_COL_LABELS[p]}: {val}"
    return name


def _load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def load_model():
    """Load the Random-Forest model + the preprocessing artifacts exported from
    the training notebooks. If any piece is missing the API falls back to demo
    mode so the rest of the app keeps working."""
    global model, scaler, encoded_columns, selected_features, scaled_columns, model_feature_names
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            fn = getattr(model, "feature_names_in_", None)
            model_feature_names = [str(c) for c in fn] if fn is not None else []
            print(f"[OK] Model loaded ({getattr(model, 'n_features_in_', '?')} features)")
        except Exception as e:
            print(f"[WARN] Failed to load model: {e}")
    else:
        print("[WARN] No model.joblib in backend/ml/ — live prediction disabled (demo mode)")

    if os.path.exists(SCALER_PATH):
        try:
            scaler = joblib.load(SCALER_PATH)
            print("[OK] Scaler loaded")
        except Exception as e:
            print(f"[WARN] Failed to load scaler: {e}")

    encoded_columns = _load_json(ENCODED_COLS, [])
    selected_features = _load_json(SELECTED_FEATS, [])
    scaled_columns = _load_json(SCALED_COLS, scaled_columns)
    if encoded_columns and selected_features:
        print(f"[OK] Feature artifacts loaded ({len(selected_features)} selected / {len(encoded_columns)} encoded)")
    else:
        print("[WARN] Missing encoded_columns.json / selected_features.json — live prediction disabled")


# Priority ordering for sorting
_PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def generate_recommendations(input_data: dict, result: dict) -> list[dict]:
    """
    Generate personalised retention recommendations based on customer
    input fields and predicted churn probability.

    Returns a list of dicts (top 5-6, sorted by priority):
        category, priority, icon, title, detail
    """
    prob: float = result.get("churn_probability", 0.0)
    age: float = float(input_data.get("age") or 0)
    tenure: float = float(input_data.get("tenure") or 0)
    balance: float = float(input_data.get("acct_balance") or 0)
    score_kyc: str = str(input_data.get("score_kyc") or "").strip().upper()
    partyclass: str = str(input_data.get("partyclass") or "").strip()
    currency: str = str(input_data.get("currency") or "").strip().upper()
    marital_status: str = str(input_data.get("marital_status") or "").strip()

    recommendations: list[dict] = []

    # ------------------------------------------------------------------ #
    # Rules engine                                                         #
    # ------------------------------------------------------------------ #

    # 1. Critical probability threshold
    if prob > 0.9:
        recommendations.append({
            "category": "Urgent Intervention",
            "priority": "critical",
            "icon": "🚨",
            "title": "Immediate Account Intervention",
            "detail": (
                "Churn probability exceeds 90%. Schedule a personal relationship-manager "
                "visit within 24 hours. Prepare a bespoke retention offer before the meeting."
            ),
        })

    # 2. High probability threshold
    if prob > 0.7:
        recommendations.append({
            "category": "Outreach",
            "priority": "high",
            "icon": "📞",
            "title": "Personal Outreach Call",
            "detail": (
                "Churn probability is high (> 70%). A senior relationship manager should "
                "call the customer within 48 hours to understand concerns and present a "
                "tailored retention package."
            ),
        })

    # 3. Young customer – digital engagement
    if age < 30:
        recommendations.append({
            "category": "Digital Engagement",
            "priority": "medium",
            "icon": "📱",
            "title": "Digital Engagement Programme",
            "detail": (
                "Customer is under 30. Prioritise mobile-first features, in-app personalisation, "
                "and targeted push-notification campaigns to strengthen digital loyalty."
            ),
        })

    # 4. Senior customer – dedicated support
    if age > 60:
        recommendations.append({
            "category": "Senior Support",
            "priority": "medium",
            "icon": "🤝",
            "title": "Senior Banking Support",
            "detail": (
                "Customer is over 60. Assign a dedicated phone-support agent and offer a "
                "simplified UX experience with larger print statements and in-branch assistance."
            ),
        })

    # 5. New customer – onboarding
    if tenure < 1:
        recommendations.append({
            "category": "Onboarding",
            "priority": "high",
            "icon": "🎯",
            "title": "New Customer Onboarding",
            "detail": (
                "Customer has been with the bank less than 1 year. Assign a dedicated "
                "relationship manager, send a personalised welcome kit, and schedule a "
                "loyalty reward milestone at the 6-month mark."
            ),
        })

    # 6. Long-tenured customer – VIP recognition
    if tenure >= 10:
        recommendations.append({
            "category": "Loyalty",
            "priority": "medium",
            "icon": "⭐",
            "title": "Long-term Loyalty Recognition",
            "detail": (
                "Customer has been with the bank for 10 or more years. Upgrade to VIP tier, "
                "offer exclusive benefits (priority queuing, zero-fee transactions, concierge "
                "banking), and send a personalised anniversary letter."
            ),
        })

    # 7. Low balance + elevated churn risk → fee relief
    if balance < 5000 and prob > 0.4:
        recommendations.append({
            "category": "Fee Management",
            "priority": "high",
            "icon": "💳",
            "title": "Fee Relief Programme",
            "detail": (
                "Account balance is below 5,000 and churn risk is elevated. Waive monthly "
                "maintenance fees for 6 months and introduce a savings-incentive programme "
                "to help grow the balance."
            ),
        })

    # 8. High-value account – wealth management
    if balance > 100000:
        recommendations.append({
            "category": "Wealth Management",
            "priority": "high",
            "icon": "💎",
            "title": "Premium Wealth Management",
            "detail": (
                "Account balance exceeds 100,000. Refer to the private banking division, "
                "assign a dedicated wealth advisor, and present a personalised investment "
                "and estate-planning package."
            ),
        })

    # 9. High-risk KYC tier – compliance support
    if score_kyc in ("H1", "H2", "H3"):
        recommendations.append({
            "category": "Compliance",
            "priority": "medium",
            "icon": "📋",
            "title": "KYC Assistance",
            "detail": (
                f"KYC risk rating is '{score_kyc}' (high-risk tier). Provide guided document-upload "
                "support via the mobile app and assign a dedicated compliance officer to "
                "resolve any outstanding verification issues."
            ),
        })

    # 10. Business / SME client – relationship review
    if partyclass.lower() in ("corporate", "sme"):
        recommendations.append({
            "category": "Business Banking",
            "priority": "medium",
            "icon": "🏢",
            "title": "Business Banking Review",
            "detail": (
                f"Customer is classified as '{partyclass}'. Schedule a quarterly relationship "
                "review with the business-banking team to reassess credit facilities, cash-"
                "management solutions, and growth financing opportunities."
            ),
        })

    # 11. Non-TND currency – multi-currency optimisation
    if currency and currency != "TND":
        recommendations.append({
            "category": "FX Services",
            "priority": "low",
            "icon": "💱",
            "title": "Multi-currency Optimisation",
            "detail": (
                f"Account operates in {currency}. Offer preferential FX conversion rates, "
                "a bundled international transfer package, and access to a multi-currency "
                "account to reduce transaction costs."
            ),
        })

    # 12. Life transition – financial planning
    if marital_status.lower() in ("divorced", "widowed"):
        recommendations.append({
            "category": "Life Transition",
            "priority": "medium",
            "icon": "💼",
            "title": "Life Transition Support",
            "detail": (
                f"Customer is {marital_status.lower()}. Offer a complimentary, dedicated "
                "financial-planning session covering account restructuring, beneficiary updates, "
                "and appropriate insurance or investment products."
            ),
        })

    # 13. High-value retention offer
    if prob > 0.5 and balance > 50000:
        recommendations.append({
            "category": "Retention Offer",
            "priority": "high",
            "icon": "🎁",
            "title": "High-Value Retention Offer",
            "detail": (
                "Elevated churn risk combined with a high account balance. Present an exclusive "
                "interest-rate upgrade on savings, full fee waivers for 12 months, and a "
                "dedicated relationship line."
            ),
        })

    # ------------------------------------------------------------------ #
    # Guarantee at least 3 recommendations with generic fallbacks          #
    # ------------------------------------------------------------------ #
    if len(recommendations) < 3:
        generic_pool = _generic_recommendations(prob)
        for rec in generic_pool:
            if len(recommendations) >= 3:
                break
            # Avoid exact-title duplicates
            existing_titles = {r["title"] for r in recommendations}
            if rec["title"] not in existing_titles:
                recommendations.append(rec)

    # Sort by priority (critical → high → medium → low)
    recommendations.sort(key=lambda r: _PRIORITY_ORDER.get(r["priority"], 9))

    # Return top 5-6 (cap at 6 to keep the UI digestible)
    return recommendations[:6]


def _generic_recommendations(prob: float) -> list[dict]:
    """Return generic fallback recommendations ordered by probability."""
    recs = []

    if prob >= 0.5:
        recs.append({
            "category": "Retention",
            "priority": "high",
            "icon": "🔔",
            "title": "Proactive Retention Campaign",
            "detail": (
                "Enrol the customer in a targeted retention campaign: personalised email "
                "series, exclusive product offers, and a loyalty-points bonus to re-engage."
            ),
        })

    recs.append({
        "category": "Engagement",
        "priority": "medium",
        "icon": "📊",
        "title": "Customer Satisfaction Survey",
        "detail": (
            "Send a brief satisfaction survey to identify pain points. Use the results to "
            "tailor product recommendations and improve the overall banking experience."
        ),
    })

    recs.append({
        "category": "Education",
        "priority": "low",
        "icon": "📚",
        "title": "Financial Wellness Education",
        "detail": (
            "Share personalised financial-literacy content (budgeting tips, savings guides, "
            "investment basics) to increase product engagement and deepen the relationship."
        ),
    })

    recs.append({
        "category": "Cross-sell",
        "priority": "low",
        "icon": "🛒",
        "title": "Product Cross-sell Opportunity",
        "detail": (
            "Analyse the customer's current product mix and present complementary offerings "
            "(e.g. personal loan, savings account, insurance) that match their profile."
        ),
    })

    return recs


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _build_feature_frame(input_data: dict) -> pd.DataFrame:
    """Reproduce the training preprocessing for ONE raw customer:
    KYC ordinal → MinMax-scale numerics → one-hot align → select 30 features.
    Returns a 1-row DataFrame indexed by `selected_features`."""
    raw = {str(k).upper(): v for k, v in input_data.items()}

    # KYC text → ordinal (LR=1 … H3=5)
    kyc_raw = raw.get("SCORE_KYC")
    kyc_ord = KYC_ORDINAL.get(str(kyc_raw).strip().upper(), 0) if kyc_raw not in (None, "") else 0

    num_map = {
        "AGE": _num(raw.get("AGE")),
        "TENURE": _num(raw.get("TENURE")),
        "ACCT_BALANCE": _num(raw.get("ACCT_BALANCE")),
        "SCORE_KYC": float(kyc_ord),
    }

    # MinMax-scale the numerics in the exact training order
    ordered = pd.DataFrame([[num_map.get(c, 0.0) for c in scaled_columns]], columns=scaled_columns)
    if scaler is not None:
        try:
            scaled = scaler.transform(ordered)[0]
        except Exception:
            scaled = ordered.iloc[0].values
    else:
        scaled = ordered.iloc[0].values
    scaled_map = dict(zip(scaled_columns, scaled))

    # Zero vector over the full encoded column space
    vec = {c: 0.0 for c in encoded_columns}
    for c, v in scaled_map.items():
        if c in vec:
            vec[c] = float(v)

    # One-hot the categoricals (fall back to *_OTHER, else the dropped reference)
    for col in CAT_COLS:
        val = raw.get(col)
        if val in (None, ""):
            continue
        name = f"{col}_{val}"
        if name in vec:
            vec[name] = 1.0
        else:
            other = f"{col}_OTHER"
            if other in vec:
                vec[other] = 1.0

    row = {f: vec.get(f, 0.0) for f in selected_features}
    return pd.DataFrame([row], columns=selected_features)


def _demo_result(input_data: dict) -> dict:
    res = {
        "churn_probability": 0.72,
        "risk_level": "high",
        "confidence": "Demo mode — no model loaded yet",
        "shap_contributions": {"tenure": -0.35, "acct_balance": -0.28, "age": 0.18,
                               "partyclass": 0.15, "score_kyc": -0.12},
        "demo": True,
    }
    res["recommendations"] = generate_recommendations(input_data, res)
    return res


def _build_raw_frame(input_data: dict) -> pd.DataFrame:
    """Fallback for a model trained directly on raw columns (no encoding
    pipeline). Builds a 1-row frame using the model's own feature_names_in_,
    coercing values to numeric and filling anything missing with 0."""
    low = {str(k).lower(): v for k, v in input_data.items()}
    row = {f: _num(low.get(str(f).lower())) for f in model_feature_names}
    return pd.DataFrame([row], columns=model_feature_names)


def predict(input_data: dict) -> dict:
    if model is None:
        return _demo_result(input_data)

    # Mode A — full training pipeline (real model + exported artifacts)
    # Mode B — model trained directly on raw columns (no artifacts needed)
    full_pipeline = bool(selected_features and encoded_columns)
    try:
        X = _build_feature_frame(input_data) if full_pipeline else _build_raw_frame(input_data)
        proba = float(model.predict_proba(X)[0][1])
    except Exception as e:
        print(f"[WARN] Prediction failed, using demo: {e}")
        return _demo_result(input_data)

    # SHAP feature contributions (handles all shap return shapes)
    top = {}
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X)
        if isinstance(shap_values, list):
            # legacy: list of per-class arrays [class0, class1], each (n, n_features)
            vals = np.array(shap_values[1] if len(shap_values) > 1 else shap_values[0])[0]
        else:
            arr = np.array(shap_values)
            if arr.ndim == 3:      # (n_samples, n_features, n_classes)
                vals = arr[0, :, 1] if arr.shape[2] > 1 else arr[0, :, 0]
            else:                  # (n_samples, n_features)
                vals = arr[0]
        vals = np.array(vals, dtype=float).ravel()
        names = list(X.columns)
        contributions = dict(zip(names, [round(float(v), 4) for v in vals]))
        ranked = sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True)[:8]
        top = {_pretty_feature(k): v for k, v in ranked}
    except Exception as e:
        print(f"SHAP error: {e}")

    # Risk segments match the model's bins: <0.3 Low · 0.3–0.6 Medium · ≥0.6 High
    risk = "high" if proba >= 0.6 else "medium" if proba >= 0.3 else "low"

    result = {
        "churn_probability": round(proba, 4),
        "risk_level": risk,
        "confidence": f"{round(max(proba, 1 - proba) * 100, 1)}%",
        "shap_contributions": top,
        "demo": False,
    }
    result["recommendations"] = generate_recommendations(input_data, result)
    return result
