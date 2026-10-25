"""Compatibility training entrypoint; v2 uses grouped evaluation."""
from pathlib import Path

from it_ai_copilot.evaluation import compare_and_train

if __name__ == "__main__":
    report = compare_and_train(
        Path("data/tickets_v2.csv"),
        Path("artifacts/ticket_classifier.joblib"),
        Path("artifacts/evaluation_v2.json"),
    )
    print("Group overlap:", report["family_overlap"])
    print("Deployed model:", report["deployed_model"])
