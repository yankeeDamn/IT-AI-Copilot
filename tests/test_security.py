"""Authorization and tenant isolation tests using signed OIDC test identities."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from it_ai_copilot import security
from it_ai_copilot.api import app
from it_ai_copilot.evaluation import compare_and_train
from it_ai_copilot.store import Membership, Organization


@pytest.fixture
def secured_client(tmp_path, monkeypatch):
    model = tmp_path / "model.joblib"
    compare_and_train(Path("data/tickets_v2.csv"), model, tmp_path / "report.json")
    monkeypatch.setenv("MODEL_PATH", str(model))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'secure.db'}")
    monkeypatch.setenv("OIDC_ISSUER", "https://id.example.test")
    monkeypatch.setenv("OIDC_AUDIENCE", "it-ai-copilot")
    monkeypatch.setenv("OIDC_JWKS_URI", "https://id.example.test/jwks")
    # Never bypass JWT verification: substitute a test signing key resolver only.
    from cryptography.hazmat.primitives.asymmetric import rsa

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    class TestKey:
        key = public_key

    class TestJwks:
        def get_signing_key_from_jwt(self, token):
            return TestKey()

    monkeypatch.setattr(security, "jwks_client", lambda _: TestJwks())

    def token(subject):
        now = datetime.now(UTC)
        encoded = jwt.encode({
            "iss": "https://id.example.test", "aud": "it-ai-copilot",
            "sub": subject, "iat": now, "exp": now + timedelta(minutes=10),
        }, private_key, algorithm="RS256")
        return {"Authorization": f"Bearer {encoded}"}

    config = Config("alembic.ini")
    command.upgrade(config, "head")
    with TestClient(app) as client:
        with app.state.session_factory() as session:
            a = Organization(slug="org-a", name="Organization A")
            b = Organization(slug="org-b", name="Organization B")
            session.add_all([a, b])
            session.flush()
            session.add_all([
                Membership(organization_id=a.id, subject="https://id.example.test|alice",
                           role="technician", active=True),
                Membership(organization_id=a.id, subject="https://id.example.test|bob",
                           role="admin", active=True),
                Membership(organization_id=a.id, subject="https://id.example.test|viewer",
                           role="viewer", active=True),
                Membership(organization_id=b.id, subject="https://id.example.test|mallory",
                           role="admin", active=True),
            ])
            session.commit()
            a_id, b_id = a.id, b.id
        yield client, token, a_id, b_id


def test_tenant_isolation_and_separate_approval(secured_client):
    client, token, org, other = secured_client
    path = f"/v1/organizations/{org}/tickets"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=token("mallory")).status_code == 403
    created = client.post(path, headers=token("alice"), json={
        "title": "VPN disconnects", "description": "VPN disconnects frequently"
    })
    assert created.status_code == 201, created.text
    ticket_id = created.json()["id"]
    assert client.get(f"/v1/organizations/{other}/tickets/{ticket_id}",
                      headers=token("mallory")).status_code == 404
    assert client.post(path, headers=token("viewer"), json={
        "title": "Cannot create", "description": "Viewer must be read only"
    }).status_code == 403
    request = client.post(
        f"/v1/organizations/{org}/tickets/{ticket_id}/automations",
        headers=token("alice"), json={"playbook": "collect_diagnostics"}
    )
    assert request.status_code == 201, request.text
    req_id = request.json()["id"]
    approve_url = f"/v1/organizations/{org}/automations/{req_id}/approve"
    assert client.post(approve_url, headers=token("alice")).status_code == 403
    assert client.post(approve_url, headers=token("mallory")).status_code == 403
    approved = client.post(approve_url, headers=token("bob"))
    assert approved.status_code == 200, approved.text
    assert approved.json()["executed"] is False
    assert client.post(approve_url, headers=token("bob")).status_code == 409


def test_unsigned_or_wrong_audience_rejected(secured_client):
    client, _token, org, _ = secured_client
    path = f"/v1/organizations/{org}/tickets"
    assert client.get(path, headers={"Authorization": "Bearer fake"}).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer " + jwt.encode({
        "iss": "https://id.example.test", "aud": "wrong", "sub": "alice",
        "iat": datetime.now(UTC), "exp": datetime.now(UTC) + timedelta(minutes=5),
    }, "secret", algorithm="HS256")}).status_code == 401
