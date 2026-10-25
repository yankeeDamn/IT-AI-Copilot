from pathlib import Path

from fastapi.testclient import TestClient

from it_ai_copilot.api import app
from it_ai_copilot.evaluation import compare_and_train


def test_ticket_lifecycle_and_approval(tmp_path, monkeypatch):
    model_path = tmp_path / "model.joblib"
    compare_and_train(Path("data/tickets_v2.csv"), model_path, tmp_path / "report.json")
    monkeypatch.setenv("MODEL_PATH", str(model_path))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("COPILOT_API_KEY", "testing-secret")
    monkeypatch.setenv("KNOWLEDGE_DIR", "knowledge")
    with TestClient(app) as client:
        assert client.get("/v1/tickets").status_code == 401
        headers = {"x-api-key": "testing-secret"}
        created = client.post("/v1/tickets", headers=headers, json={
            "title": "VPN keeps dropping", "description": "VPN disconnects frequently"
        })
        assert created.status_code == 201, created.text
        ticket_id = created.json()["id"]
        assert len(client.get("/v1/tickets", headers=headers).json()) == 1
        predicted = client.post(f"/v1/tickets/{ticket_id}/classify", headers=headers)
        assert predicted.status_code == 200
        updated = client.patch(f"/v1/tickets/{ticket_id}", headers=headers,
                               json={"status": "resolved", "assignee": "helpdesk"})
        assert updated.status_code == 200
        assert updated.json()["resolved_at"] is not None
        results = client.get("/v1/knowledge/search", params={"q": "VPN"}, headers=headers)
        assert results.status_code == 200
        assert results.json()[0]["source"] == "network-vpn.md"
        suggestion = client.post(f"/v1/tickets/{ticket_id}/suggest", headers=headers)
        assert suggestion.status_code == 200
        assert suggestion.json()["requires_human_review"]
        summary = client.get("/v1/dashboard/summary", headers=headers)
        assert summary.status_code == 200
        request = client.post(f"/v1/tickets/{ticket_id}/automations", headers=headers,
                              json={"playbook": "collect_diagnostics"})
        assert request.status_code == 201
        request_id = request.json()["id"]
        approval = client.post(f"/v1/automations/{request_id}/approve", headers=headers)
        assert approval.status_code == 200
        assert approval.json()["executed"] is False
        assert client.post(f"/v1/automations/{request_id}/approve",
                           headers=headers).status_code == 409
        audit = client.get(f"/v1/tickets/{ticket_id}/audit", headers=headers)
        assert len(audit.json()) >= 5
