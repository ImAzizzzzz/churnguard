"""Tests for the live-prediction preprocessing pipeline and SHAP labels."""
import pytest
from services import ml_service

ml_service.load_model()
HAS_MODEL = bool(ml_service.model and ml_service.selected_features and ml_service.encoded_columns)

SAMPLE = {
    "age": 45, "tenure": 2, "acct_balance": 8500, "score_kyc": "MR",
    "partyclass": "PPH", "industry": 6910, "lob": 4, "currency": "TND",
    "marital_status": "S", "nature_client": "X", "account_category": 1,
}


def test_pretty_feature_numeric():
    assert ml_service._pretty_feature("TENURE") == "Tenure"
    assert ml_service._pretty_feature("SCORE_KYC") == "KYC score"
    assert ml_service._pretty_feature("ACCT_BALANCE") == "Account balance"


def test_pretty_feature_categorical():
    assert ml_service._pretty_feature("ACCOUNT_CATEGORY_6001.0") == "Account category: 6001"
    assert ml_service._pretty_feature("LOB_4") == "Line of business: 4"
    assert ml_service._pretty_feature("CURRENCY_TND") == "Currency: TND"


def test_pretty_feature_passthrough():
    assert ml_service._pretty_feature("SOMETHING_ELSE_X") == "SOMETHING_ELSE_X"


def test_kyc_ordinal_map():
    assert ml_service.KYC_ORDINAL == {"LR": 1, "MR": 2, "H1": 3, "H2": 4, "H3": 5}


@pytest.mark.skipif(not HAS_MODEL, reason="model artifacts not present")
def test_build_feature_frame_shape():
    X = ml_service._build_feature_frame(SAMPLE)
    assert X.shape == (1, len(ml_service.selected_features))
    assert list(X.columns) == ml_service.selected_features
    # all numeric, no NaN
    assert X.isna().sum().sum() == 0
    assert all(str(d).startswith(("float", "int")) for d in X.dtypes)


@pytest.mark.skipif(not HAS_MODEL, reason="model artifacts not present")
def test_predict_returns_valid_result():
    res = ml_service.predict(SAMPLE)
    assert 0.0 <= res["churn_probability"] <= 1.0
    assert res["risk_level"] in ("high", "medium", "low")
    assert res["demo"] is False
    assert len(res["recommendations"]) >= 3


@pytest.mark.skipif(not HAS_MODEL, reason="model artifacts not present")
def test_predictions_vary_with_input():
    low = ml_service.predict({**SAMPLE, "tenure": 20, "acct_balance": 500000})
    high = ml_service.predict({**SAMPLE, "tenure": 0, "acct_balance": 50})
    # different inputs should not produce identical probabilities
    assert low["churn_probability"] != high["churn_probability"]
