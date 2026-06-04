"""Unit tests for the rule-based retention recommendation engine."""
from services.ml_service import generate_recommendations


def _titles(recs):
    return {r["title"] for r in recs}


def test_returns_at_least_three_recommendations():
    recs = generate_recommendations({"age": 40, "tenure": 5, "acct_balance": 10000}, {"churn_probability": 0.3})
    assert len(recs) >= 3


def test_caps_at_six_recommendations():
    # A profile that triggers many rules at once
    profile = {"age": 24, "tenure": 0.5, "acct_balance": 200000,
               "score_kyc": "D", "partyclass": "SME", "currency": "USD",
               "marital_status": "divorced"}
    recs = generate_recommendations(profile, {"churn_probability": 0.95})
    assert len(recs) <= 6


def test_high_probability_triggers_urgent_action():
    recs = generate_recommendations({"age": 40, "tenure": 5, "acct_balance": 10000}, {"churn_probability": 0.95})
    cats = {r["category"] for r in recs}
    assert "Urgent Intervention" in cats or "Outreach" in cats


def test_young_customer_gets_digital_engagement():
    recs = generate_recommendations({"age": 22, "tenure": 2, "acct_balance": 8000}, {"churn_probability": 0.5})
    assert "Digital Engagement Programme" in _titles(recs)


def test_low_balance_elevated_risk_gets_fee_relief():
    recs = generate_recommendations({"age": 40, "tenure": 3, "acct_balance": 1000}, {"churn_probability": 0.6})
    assert "Fee Relief Programme" in _titles(recs)


def test_recommendations_sorted_by_priority():
    profile = {"age": 24, "tenure": 0.5, "acct_balance": 1000, "score_kyc": "D"}
    recs = generate_recommendations(profile, {"churn_probability": 0.95})
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    priorities = [order.get(r["priority"], 9) for r in recs]
    assert priorities == sorted(priorities)


def test_each_recommendation_has_required_fields():
    recs = generate_recommendations({"age": 40, "tenure": 5, "acct_balance": 10000}, {"churn_probability": 0.5})
    for r in recs:
        assert {"category", "priority", "icon", "title", "detail"} <= set(r.keys())
