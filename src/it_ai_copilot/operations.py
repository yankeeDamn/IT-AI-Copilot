"""Authenticated ticket APIs and human-only automation approval.

Development auth is a single API key, not tenant-aware identity. Do not expose publicly.
"""
from __future__ import annotations

import hmac
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from it_ai_copilot.assistant import suggest_resolution
from it_ai_copilot.knowledge import search_knowledge
from it_ai_copilot.store import AuditEvent, AutomationRequest, Ticket

router = APIRouter(prefix="/v1", tags=["IT operations"])
STATUSES = {"open", "in_progress", "resolved", "closed"}
PRIORITIES = {"low", "medium", "high", "critical"}
PLAYBOOKS = {"collect_diagnostics", "request_password_reset"}


def actor(x_api_key: str | None = Header(default=None)) -> str:
    expected = os.environ.get("COPILOT_API_KEY", "")
    if not expected or not x_api_key or not hmac.compare_digest(expected, x_api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    return "api_operator"


def db():
    from it_ai_copilot.api import app

    factory = app.state.session_factory
    with factory() as session:
        yield session


class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=3, max_length=4000)
    priority: str = "medium"


class TicketUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    assignee: str | None = Field(default=None, max_length=120)


class AutomationCreate(BaseModel):
    playbook: str


def record(session: Session, ticket_id: int, action: str, who: str, detail: str = ""):
    session.add(AuditEvent(ticket_id=ticket_id, action=action, actor=who, detail=detail))


def get_ticket(session: Session, ticket_id: int) -> Ticket:
    ticket = session.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


def serialize(ticket: Ticket) -> dict:
    return {
        "id": ticket.id, "title": ticket.title, "description": ticket.description,
        "category": ticket.category, "priority": ticket.priority, "status": ticket.status,
        "assignee": ticket.assignee, "created_at": ticket.created_at.isoformat(),
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
    }


@router.post("/tickets", status_code=201)
def create_ticket(payload: TicketCreate, who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    if payload.priority not in PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid priority")
    ticket = Ticket(title=payload.title, description=payload.description, priority=payload.priority)
    session.add(ticket)
    session.flush()
    record(session, ticket.id, "created", who)
    session.commit()
    return serialize(ticket)


@router.get("/tickets")
def list_tickets(who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    tickets = session.scalars(select(Ticket).order_by(Ticket.id.desc()).limit(100)).all()
    return [serialize(t) for t in tickets]


@router.get("/tickets/{ticket_id}")
def ticket_detail(ticket_id: int, who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    return serialize(get_ticket(session, ticket_id))


@router.patch("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, payload: TicketUpdate, who: Annotated[str, Depends(actor)],
                  session: Annotated[Session, Depends(db)]):
    ticket = get_ticket(session, ticket_id)
    changes = payload.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] not in STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    if "priority" in changes and changes["priority"] not in PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid priority")
    for field, value in changes.items():
        setattr(ticket, field, value)
    if "status" in changes:
        ticket.resolved_at = datetime.now(UTC) if ticket.status == "resolved" else None
    record(session, ticket.id, "updated", who, str(changes)[:1000])
    session.commit()
    return serialize(ticket)


@router.post("/tickets/{ticket_id}/classify")
def classify_ticket(ticket_id: int, who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    from it_ai_copilot.api import app

    ticket = get_ticket(session, ticket_id)
    model = app.state.model
    probabilities = model.predict_proba([ticket.description])[0]
    best = int(probabilities.argmax())
    label = str(model.classes_[best])
    confidence = float(probabilities[best])
    needs_review = confidence < 0.65
    if not needs_review:
        ticket.category = label
    record(session, ticket.id, "classified", who, f"{label} score={confidence:.4f}")
    session.commit()
    return {"label": label, "confidence": confidence, "needs_review": needs_review,
            "category_saved": not needs_review}


@router.get("/knowledge/search")
def knowledge_search(q: str, who: Annotated[str, Depends(actor)]):
    return search_knowledge(q, Path(os.environ.get("KNOWLEDGE_DIR", "knowledge")))


@router.post("/tickets/{ticket_id}/suggest")
async def suggest(ticket_id: int, who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    ticket = get_ticket(session, ticket_id)
    sources = search_knowledge(ticket.description, Path(os.environ.get("KNOWLEDGE_DIR", "knowledge")))
    answer = await suggest_resolution(ticket.description, sources)
    record(session, ticket.id, "suggestion_requested", who, answer["provider"])
    session.commit()
    return answer


@router.get("/dashboard/summary")
def dashboard_summary(who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    status_rows = session.execute(select(Ticket.status, func.count()).group_by(Ticket.status)).all()
    category_rows = session.execute(select(Ticket.category, func.count()).group_by(Ticket.category)).all()
    resolution_hours = [
        (ticket.resolved_at - ticket.created_at).total_seconds() / 3600
        for ticket in session.scalars(select(Ticket).where(Ticket.resolved_at.is_not(None))).all()
        if ticket.resolved_at is not None
    ]
    return {"by_status": dict(status_rows), "by_category": {k or "unclassified": v for k, v in category_rows},
            "average_resolution_hours": round(sum(resolution_hours) / len(resolution_hours), 2)
            if resolution_hours else None,
            "note": "Classification accuracy requires verified human labels; not available yet."}


@router.post("/tickets/{ticket_id}/automations", status_code=201)
def request_automation(ticket_id: int, payload: AutomationCreate,
                       who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    get_ticket(session, ticket_id)
    if payload.playbook not in PLAYBOOKS:
        raise HTTPException(status_code=422, detail="Unsupported playbook")
    request = AutomationRequest(ticket_id=ticket_id, playbook=payload.playbook, requested_by=who)
    session.add(request)
    session.flush()
    record(session, ticket_id, "automation_requested", who, payload.playbook)
    session.commit()
    return {"id": request.id, "status": request.status, "executed": False}


@router.post("/automations/{request_id}/approve")
def approve_automation(request_id: int, who: Annotated[str, Depends(actor)],
                       session: Annotated[Session, Depends(db)]):
    request = session.get(AutomationRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="Already reviewed")
    # Approval is recorded only; no script or external integration is executed.
    request.status = "approved"
    request.reviewed_by = who
    record(session, request.ticket_id, "automation_approved", who, request.playbook)
    session.commit()
    return {"id": request.id, "status": request.status, "executed": False}


@router.get("/tickets/{ticket_id}/audit")
def audit(ticket_id: int, who: Annotated[str, Depends(actor)], session: Annotated[Session, Depends(db)]):
    get_ticket(session, ticket_id)
    events = session.scalars(select(AuditEvent).where(AuditEvent.ticket_id == ticket_id)
                             .order_by(AuditEvent.id.desc())).all()
    return [{"action": e.action, "actor": e.actor, "detail": e.detail,
             "created_at": e.created_at.isoformat()} for e in events]
