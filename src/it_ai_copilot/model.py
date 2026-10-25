"""Deterministic training and model persistence."""
from __future__ import annotations

import csv
import json
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

LABELS = ("account_access", "hardware", "network", "software")


def load_dataset(path: Path) -> tuple[list[str], list[str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not {"text", "label"}.issubset(reader.fieldnames or []):
            raise ValueError("Dataset must have text,label columns")
        rows = [(row["text"].strip(), row["label"].strip()) for row in reader]
    if not rows or any(not text or label not in LABELS for text, label in rows):
        raise ValueError("Dataset contains missing text or unsupported labels")
    if len({text.casefold() for text, _ in rows}) != len(rows):
        raise ValueError("Duplicate ticket texts can leak across splits")
    return [x for x, _ in rows], [y for _, y in rows]


def train(data_path: Path, model_path: Path, metrics_path: Path) -> dict:
    texts, labels = load_dataset(data_path)
    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.25, stratify=labels, random_state=42
    )
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
        ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)),
    ])
    pipeline.fit(x_train, y_train)
    predictions = pipeline.predict(x_test)
    metrics = {
        "dataset_size": len(texts),
        "train_size": len(x_train),
        "test_size": len(x_test),
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "macro_f1": round(float(f1_score(y_test, predictions, average="macro", zero_division=0)), 4),
        "classification_report": classification_report(
            y_test, predictions, labels=list(LABELS), output_dict=True, zero_division=0
        ),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=list(LABELS)).tolist(),
        "label_order": list(LABELS),
        "caveat": "Synthetic starter dataset; metrics do not estimate real-world performance.",
    }
    model_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_path)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics
