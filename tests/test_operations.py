"""Legacy API-key integration tests superseded by OIDC tenant tests.

The current authenticated routes are exercised in test_security.py.
"""


def test_legacy_api_key_is_not_supported():
    from it_ai_copilot.api import app

    paths = {route.path for route in app.routes if hasattr(route, 'path')}
    assert "/v1/tickets" not in paths
    assert "/v1/organizations/{organization_id}/tickets" in paths
