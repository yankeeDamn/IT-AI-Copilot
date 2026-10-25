from pathlib import Path

import pytest

from it_ai_copilot.model import LABELS, load_dataset, train


def test_dataset_has_all_labels():
    texts, labels = load_dataset(Path("data/tickets.csv"))
    assert len(texts) >= 80
    assert set(labels) == set(LABELS)


def test_train_creates_artifacts(tmp_path):
    model = tmp_path / "model.joblib"
    metrics_file = tmp_path / "metrics.json"
    metrics = train(Path("data/tickets.csv"), model, metrics_file)
    assert model.is_file() and metrics_file.is_file()
    assert 0 <= metrics["macro_f1"] <= 1
    assert metrics["test_size"] > 0


def test_rejects_duplicate_text(tmp_path):
    data = tmp_path / "bad.csv"
    data.write_text("text,label\nSame issue,network\nSame issue,network\n", encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate"):
        load_dataset(data)
