"""Contract tests for frontend-scoped membership and approval listing routes."""
from it_ai_copilot.operations import router


def test_dashboard_routes_are_tenant_scoped():
    mapping = {getattr(route, "path", None): getattr(route, "methods", set()) for route in router.routes}
    base = "/v1/organizations/{organization_id}"
    assert "GET" in mapping[base + "/me"]
    assert "GET" in mapping[base + "/automations"]
    assert "GET" in mapping[base + "/dashboard/summary"]
    assert "POST" in mapping[base + "/tickets"]
    assert "POST" in mapping[base + "/automations/{request_id}/approve"]
