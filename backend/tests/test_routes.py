"""
Lightweight API route tests using FastAPI's TestClient.

These run WITHOUT a live database: TestClient is used without the `with`
context, so the lifespan (DB create_all / model load / migrations) never runs,
and we only exercise paths that don't touch the DB — health check, auth
guards, and request validation. They catch routing regressions like the
``/permissions/users`` 404 and missing-endpoint mistakes.
"""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_root_health():
    r = client.get("/")
    assert r.status_code == 200
    assert "status" in r.json()


def test_protected_routes_reject_anonymous():
    # No Authorization header → must be rejected (401 from token decode or 403 from bearer guard).
    for path in [
        "/analytics/kpis",
        "/permissions/all",
        "/customers/high-risk",
        "/notifications/",
        "/reports/predictions",
    ]:
        r = client.get(path)
        assert r.status_code in (401, 403), f"{path} returned {r.status_code}"


def test_login_requires_body():
    r = client.post("/auth/login", json={})
    assert r.status_code == 422  # pydantic validation error


def test_unknown_route_is_404():
    r = client.get("/permissions/users")  # the old buggy path — must not exist
    assert r.status_code == 404
