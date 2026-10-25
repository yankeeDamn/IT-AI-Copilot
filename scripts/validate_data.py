"""Validate the v2 dataset before training."""
from pathlib import Path

from it_ai_copilot.evaluation import read_v2

if __name__ == "__main__":
    rows = read_v2(Path("data/tickets_v2.csv"))
    print(f"Validated {len(rows)} tickets.")
