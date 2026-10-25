"""Train and compare baseline models with grouped holdout."""
from pathlib import Path

from it_ai_copilot.evaluation import compare_and_train

if __name__ == "__main__":
    report = compare_and_train(
        Path("data/tickets_v2.csv"),
        Path("artifacts/ticket_classifier.joblib"),
        Path("artifacts/evaluation_v2.json"),
    )
    for name, metrics in report["comparison"].items():
        print(f"{name}: macro-F1={metrics['macro_f1']:.3f}")
    print("Family overlap:", report["family_overlap"])
    print("Model SHA256:", report["model_sha256"])
