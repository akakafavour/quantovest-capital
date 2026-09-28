import os
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "tests" / "openapi.yaml"


def test_openapi_contract_is_well_formed():
    spec = yaml.safe_load(SPEC_PATH.read_text())
    assert spec["openapi"].startswith("3.")
    assert "/api/auth/me" in spec["paths"]
    assert "/api/plans" in spec["paths"]
    assert "200" in spec["paths"]["/api/auth/me"]["get"]["responses"]
    assert "401" in spec["paths"]["/api/auth/me"]["get"]["responses"]


def test_production_auth_redirects_use_canonical_app_url():
    signup_route = (ROOT / "app" / "api" / "auth" / "signup" / "route.ts").read_text()
    middleware = (ROOT / "middleware.ts").read_text()
    callback = (ROOT / "app" / "auth" / "callback" / "route.ts").read_text()
    redirect_helper = (ROOT / "lib" / "auth-redirect.ts").read_text()
    # Signup must build its email redirect from the allowlisted canonical URL
    # helper (fail-closed in prod), never from the request origin.
    assert "getAllowedAppUrl" in signup_route
    assert "buildEmailRedirectTo" in signup_route
    assert "process.env.APP_PUBLIC_URL" in redirect_helper
    assert "www.quantovests.com" in redirect_helper
    assert "/auth/callback" in redirect_helper
    assert "pathname === '/' && searchParams.has('code')" in middleware
    assert "pathname = '/auth/callback'" in middleware
    assert "exchangeCodeForSession" in callback


def test_live_public_contracts_when_base_url_is_configured():
    base_url = os.getenv("BASE_URL")
    if not base_url:
        return
    base_url = base_url.rstrip("/")
    me = requests.get(f"{base_url}/api/auth/me", timeout=15)
    assert me.status_code in (200, 401), me.text[:500]
    plans = requests.get(f"{base_url}/api/plans", timeout=15)
    assert plans.status_code == 200, plans.text[:500]
    assert isinstance(plans.json(), list)
