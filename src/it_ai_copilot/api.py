"""Inference-only API; train artifacts separately before startup."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from it_ai_copilot.model import LABELS
from it_ai_copilot.operations import router as operations_router


class TicketRequest(BaseModel):
    text: str = Field(min_length=3, max_length=4000)


class PredictionResponse(BaseModel):
    label: str
    confidence: float
    scores: dict[str, float]
    model_version: str = "0.2.0"
    needs_review: bool = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    path = Path(os.environ.get("MODEL_PATH", "artifacts/ticket_classifier.joblib"))
    if not path.is_file():
        raise RuntimeError(f"Model artifact missing: {path}. Run training first.")
    # joblib uses pickle: only load artifacts produced by trusted training pipelines.
    app.state.model = joblib.load(path)
    from it_ai_copilot.store import session_factory

    app.state.session_factory = session_factory()
    yield


app = FastAPI(title="IT AI Copilot", version="0.3.0", lifespan=lifespan)


app.include_router(operations_router)


@app.get("/health/live")
def live():
    return {"status": "alive"}


@app.get("/health/ready")
def ready():
    return {"status": "ready"}


@app.post("/v1/predict", response_model=PredictionResponse)
def predict(ticket: TicketRequest):
    if not ticket.text.strip():
        raise HTTPException(status_code=422, detail="Ticket text cannot be blank")
    model = app.state.model
    probabilities = model.predict_proba([ticket.text])[0]
    classes = model.classes_
    scores = {str(label): round(float(prob), 6) for label, prob in zip(classes, probabilities)}
    label = str(classes[probabilities.argmax()])
    if label not in LABELS:
        raise HTTPException(status_code=500, detail="Invalid model output")
    return PredictionResponse(\n        label=label,\n        confidence=scores[label],\n        scores=scores,\n        needs_review=scores[label] < 0.65,\n    )
