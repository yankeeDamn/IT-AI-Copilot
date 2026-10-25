import csv
from pathlib import Path

import pytest

from it_ai_copilot.evaluation import compare_and_train, read_v2


def test_v2_dataset_and_grouped_evaluation(tmp_path):
    rows = read_v2(Path("data/tickets_v2.csv"))
    assert len(rows) == 120
    report = compare_and_train(
        Path("data/tickets_v2.csv"), tmp_path / "model.joblib", tmp_path / "report.json"
    )
    assert report["family_overlap"] == []
    assert report["train_rows"] + report["test_rows"] == 120
    assert set(report["comparison"]) == {"logistic_regression", "linear_svm"}
    assert len(report["model_sha256"]) == 64
    assert (tmp_path / "model.joblib").exists()


def test_conflicting_family_labels_rejected(tmp_path):
    source = list(csv.DictReader(Path("data/tickets_v2.csv").open(encoding="utf-8")))
    source[1]["label"] = "hardware" if source[0]["label"] != "hardware" else "network"
    target = tmp_path / "bad.csv"
    with target.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=source[0].keys())
        writer.writeheader()
        writer.writerows(source)
    with pytest.raises(ValueError, match="conflicting"):
        read_v2(target)
