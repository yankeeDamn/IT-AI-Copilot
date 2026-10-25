"""Leakage-resistant model comparison and artifact metadata."""
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.svm import LinearSVC

from it_ai_copilot.model import LABELS

REQUIRED = {"ticket_id", "text", "label", "incident_family", "source"}
VERSION = "0.2.0"


def read_v2(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if not REQUIRED.issubset(reader.fieldnames or []):
            raise ValueError(f"Missing columns: {sorted(REQUIRED - set(reader.fieldnames or []))}")
        rows = [{key: (value or "").strip() for key, value in row.items()} for row in reader]
    if len(rows) < 40:
        raise ValueError("At least 40 labeled examples required")
    if any(not all(row.get(k) for k in REQUIRED) or row["label"] not in LABELS for row in rows):
        raise ValueError("Empty or invalid required fields")
    for key in ("ticket_id", "text"):
        values = [row[key].casefold() for row in rows]
        if len(values) != len(set(values)):
            raise ValueError(f"Duplicate {key}")
    families: dict[str, str] = {}
    for row in rows:
        family, label = row["incident_family"], row["label"]
        if family in families and families[family] != label:
            raise ValueError("Incident family has conflicting labels")
        families[family] = label
    if any(len({row["incident_family"] for row in rows if row["label"] == label}) < 3
           for label in LABELS):
        raise ValueError("Each class needs at least three independent incident families")
    return rows


def compare_and_train(data_path: Path, model_path: Path, report_path: Path) -> dict:
    rows = read_v2(data_path)
    texts = [row["text"] for row in rows]
    labels = [row["label"] for row in rows]
    groups = [row["incident_family"] for row in rows]
    split = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(split.split(texts, labels, groups))
    train_groups = {groups[i] for i in train_idx}
    test_groups = {groups[i] for i in test_idx}
    assert train_groups.isdisjoint(test_groups)
    x_train = [texts[i] for i in train_idx]
    y_train = [labels[i] for i in train_idx]
    x_test = [texts[i] for i in test_idx]
    y_test = [labels[i] for i in test_idx]
    models = {
        "logistic_regression": make_pipeline(
            TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True),
            LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
        ),
        "linear_svm": make_pipeline(
            TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True),
            LinearSVC(class_weight="balanced", random_state=42),
        ),
    }
    results = {}
    for name, model in models.items():
        model.fit(x_train, y_train)
        predicted = model.predict(x_test)
        results[name] = {
            "accuracy": round(float(accuracy_score(y_test, predicted)), 4),
            "macro_f1": round(float(f1_score(y_test, predicted, labels=LABELS,
                                            average="macro", zero_division=0)), 4),
            "classification_report": classification_report(
                y_test, predicted, labels=list(LABELS), output_dict=True, zero_division=0
            ),
            "confusion_matrix": confusion_matrix(y_test, predicted, labels=list(LABELS)).tolist(),
        }
    # Deploy logistic regression only: its predict_proba supports existing API.
    # SVM scores are NOT probabilities. Neither model's scores are calibrated.
    model_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(models["logistic_regression"], model_path)
    sha = hashlib.sha256(model_path.read_bytes()).hexdigest()
    report = {
        "model_version": VERSION,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_sha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
        "model_sha256": sha,
        "dataset_rows": len(rows),
        "train_rows": len(train_idx),
        "test_rows": len(test_idx),
        "train_family_count": len(train_groups),
        "test_family_count": len(test_groups),
        "family_overlap": sorted(train_groups & test_groups),
        "label_order": list(LABELS),
        "deployed_model": "logistic_regression",
        "comparison": results,
        "limitations": [
            "All tickets are synthetic and generated from templates.",
            "Group split prevents known incident-family leakage, not all semantic leakage.",
            "GroupShuffleSplit is not stratified; class support varies by split.",
            "Logistic regression scores are uncalibrated; abstention threshold is heuristic.",
            "No independent real-world evaluation has been performed.",
        ],
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report
