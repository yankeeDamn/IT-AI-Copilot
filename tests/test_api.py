from pathlib import Path

from fastapi.testclient import TestClient

from it_ai_copilot import security
from it_ai_copilot.api import app
from it_ai_copilot.model import LABELS, train


def test_prediction_and_health(tmp_path, monkeypatch):
    path = tmp_path / "model.joblib"
    train(Path("data/tickets.csv"), path, tmp_path / "metrics.json")
    monkeypatch.setenv("MODEL_PATH", str(path))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'api.db'}")
    monkeypatch.setattr(security, "verified_subject", lambda _: "https://issuer|test")
    # The prediction endpoint imports verified_subject directly.
    monkeypatch.setattr("it_ai_copilot.api.verified_subject", lambda _: "https://issuer|test")
    with TestClient(app) as client:
        assert client.get("/health/live").status_code == 200
        assert client.get("/health/ready").status_code == 200
        assert client.post("/v1/predict", json={"text": "VPN drops"}).status_code == 401
        headers = {"Authorization": "Bearer test-token"}
        result = client.post(
            "/v1/predict", headers=headers, json={"text": "My VPN connection keeps dropping"}
        )
        assert result.status_code == 200
        body = result.json()
        assert body["label"] in LABELS
        assert 0 <= body["confidence"] <= 1
        assert set(body["scores"]) == set(LABELS)
        assert client.post("/v1/predict", headers=headers, json={"text": "  "}).status_code == 422
        assert client.post("/v1/predict", headers=headers, json={"text": "a"}).status_code == 422
