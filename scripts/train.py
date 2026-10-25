from pathlib import Path
from it_ai_copilot.model import train

if __name__ == "__main__":
    metrics = train(
        Path("data/tickets.csv"),
        Path("artifacts/ticket_classifier.joblib"),
        Path("artifacts/metrics.json"),
    )
    print(f"Test accuracy: {metrics['accuracy']:.3f}; macro-F1: {metrics['macro_f1']:.3f}")
    print(metrics["caveat"])
