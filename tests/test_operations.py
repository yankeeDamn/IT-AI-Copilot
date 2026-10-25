"""Legacy API-key endpoints are removed from the operations router."""
from it_ai_copilot.operations import router


def test_legacy_api_key_is_not_supported():
    paths = {route.path for route in router.routes if hasattr(route, "path")}
    assert "/v1/tickets" not in paths
    assert "/v1/organizations/{organization_id}/tickets" in paths
