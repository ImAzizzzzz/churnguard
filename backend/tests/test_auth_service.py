"""Unit tests for the authentication service (password hashing + JWT)."""
from services.auth_service import (
    hash_password, verify_password, create_token, decode_token,
)


def test_hash_password_is_not_plaintext():
    hashed = hash_password("S3cret!")
    assert hashed != "S3cret!"
    assert isinstance(hashed, str)
    assert hashed.startswith("$2")  # bcrypt prefix


def test_verify_password_accepts_correct_password():
    hashed = hash_password("correct horse battery")
    assert verify_password("correct horse battery", hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("correct horse battery")
    assert verify_password("wrong password", hashed) is False


def test_verify_password_handles_garbage_hash_gracefully():
    # Must not raise — returns False on malformed hash
    assert verify_password("whatever", "not-a-real-hash") is False


def test_create_and_decode_token_roundtrip():
    token = create_token({"sub": "analyst@bank.tn"})
    assert isinstance(token, str)
    payload = decode_token(token)
    assert payload["sub"] == "analyst@bank.tn"
    assert "exp" in payload  # expiry claim is added automatically
