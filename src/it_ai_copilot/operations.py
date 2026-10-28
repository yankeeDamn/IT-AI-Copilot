"""OIDC-authenticated, organization-scoped ticket APIs. No script execution."""
from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from it_ai_copilot.assistant import suggest_resolution
from it_ai_copilot.knowledge import search_knowledge
from it_ai_copilot.security import Principal, bearer, principal_for_session, require_role
from it_ai_copilot.store import AuditEvent, AutomationRequest, Ticket

router = APIRouter(prefix="/v1/organizations/{organization_id}", tags=["IT operations"])
STATUSES = {"open", "in_progress", "resolved", "closed"}
PRIORITIES = {"low", "medium", "high", "critical"}
PLAYBOOKS = {"collect_diagnostics", "request_password_reset"}


def db():
    from it_ai_copilot.api import app

    with app.state.session_factory() as session:
        yield session


def principal(
    organization_id: int,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: Annotated[Session, Depends(db)],
) -> Principal:
    return principal_for_session(credentials, session, organization_id)


Who = Annotated[Principal, Depends(principal)]
Database = Annotated[Session, Depends(db)]


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


def record(session: Session, ticket_id: int, who: Principal, action: str, detail: str = ""):
    session.add(AuditEvent(
        organization_id=who.organization_id, ticket_id=ticket_id,
        action=action, actor=who.subject, detail=detail,
    ))


def get_ticket(session: Session, ticket_id: int, who: Principal) -> Ticket:
    ticket = session.scalar(select(Ticket).where(
        Ticket.id == ticket_id, Ticket.organization_id == who.organization_id,
    ))
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


def serialize(ticket: Ticket) -> dict:
    return {
        "id": ticket.id, "organization_id": ticket.organization_id,
        "title": ticket.title, "description": ticket.description,
        "category": ticket.category, "priority": ticket.priority, "status": ticket.status,
        "assignee": ticket.assignee, "created_at": ticket.created_at.isoformat(),
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
    }


@router.post("/tickets", status_code=201)
def create_ticket(payload: TicketCreate, who: Who, session: Database):
    require_role(who, "technician", "admin")
    if payload.priority not in PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid priority")
    ticket = Ticket(
        organization_id=who.organization_id, title=payload.title,
        description=payload.description, priority=payload.priority,
    )
    session.add(ticket)
    session.flush()
    record(session, ticket.id, who, "created")
    session.commit()
    return serialize(ticket)


@router.get("/tickets")
def list_tickets(who: Who, session: Database):
    tickets = session.scalars(select(Ticket).where(
        Ticket.organization_id == who.organization_id,
    ).order_by(Ticket.id.desc()).limit(100)).all()
    return [serialize(t) for t in tickets]


@router.get("/tickets/{ticket_id}")
def ticket_detail(ticket_id: int, who: Who, session: Database):
    return serialize(get_ticket(session, ticket_id, who))


@router.patch("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, payload: TicketUpdate, who: Who, session: Database):
    require_role(who, "technician", "admin")
    ticket = get_ticket(session, ticket_id, who)
    changes = payload.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] not in STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")
    if "priority" in changes and changes["priority"] not in PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid priority")
    for field, value in changes.items():
        setattr(ticket, field, value)
    if "status" in changes:
        ticket.resolved_at = datetime.now(UTC) if ticket.status == "resolved" else None
    record(session, ticket.id, who, "updated", str(changes)[:1000])
    session.commit()
    return serialize(ticket)


@router.post("/tickets/{ticket_id}/classify")
def classify_ticket(ticket_id: int, who: Who, session: Database):
    from it_ai_copilot.api import app

    require_role(who, "technician", "admin")
    ticket = get_ticket(session, ticket_id, who)
    model = app.state.model
    probabilities = model.predict_proba([ticket.description])[0]
    best = int(probabilities.argmax())
    label = str(model.classes_[best])
    confidence = float(probabilities[best])
    needs_review = confidence < 0.65
    if not needs_review:
        ticket.category = label
    record(session, ticket.id, who, "classified", f"{label} score={confidence:.4f}")
    session.commit()
    return {"label": label, "confidence": confidence, "needs_review": needs_review,
            "category_saved": not needs_review}


@router.get("/knowledge/search")
def knowledge_search(q: str, who: Who):
    # The shared demo articles are public sample content; no private docs are indexed.
    return search_knowledge(q, Path(os.environ.get("KNOWLEDGE_DIR", "knowledge")))


@router.post("/tickets/{ticket_id}/suggest")
async def suggest(ticket_id: int, who: Who, session: Database):
    require_role(who, "technician", "admin")
    ticket = get_ticket(session, ticket_id, who)
    sources = search_knowledge(ticket.description, Path(os.environ.get("KNOWLEDGE_DIR", "knowledge")))
    answer = await suggest_resolution(ticket.description, sources)
    record(session, ticket.id, who, "suggestion_requested", answer["provider"])
    session.commit()
    return answer


@router.get("/dashboard/summary")
def dashboard_summary(who: Who, session: Database):
    status_rows = session.execute(select(Ticket.status, func.count()).where(
        Ticket.organization_id == who.organization_id,
    ).group_by(Ticket.status)).all()
    category_rows = session.execute(select(Ticket.category, func.count()).where(
        Ticket.organization_id == who.organization_id,
    ).group_by(Ticket.category)).all()
    resolution_hours = [
        (ticket.resolved_at - ticket.created_at).total_seconds() / 3600
        for ticket in session.scalars(select(Ticket).where(
            Ticket.organization_id == who.organization_id, Ticket.resolved_at.is_not(None),
        )).all() if ticket.resolved_at is not None
    ]
    return {
        "by_status": dict(status_rows),
        "by_category": {k or "unclassified": v for k, v in category_rows},
        "average_resolution_hours": round(sum(resolution_hours) / len(resolution_hours), 2)
        if resolution_hours else None,
        "note": "Verified-label classification accuracy is not yet available.",
    }


@router.post("/tickets/{ticket_id}/automations", status_code=201)
def request_automation(ticket_id: int, payload: AutomationCreate, who: Who, session: Database):
    require_role(who, "technician", "admin")
    get_ticket(session, ticket_id, who)
    if payload.playbook not in PLAYBOOKS:
        raise HTTPException(status_code=422, detail="Unsupported playbook")
    request = AutomationRequest(
        organization_id=who.organization_id, ticket_id=ticket_id,
        playbook=payload.playbook, requested_by=who.subject,
    )
    session.add(request)
    session.flush()
    record(session, ticket_id, who, "automation_requested", payload.playbook)
    session.commit()
    return {"id": request.id, "status": request.status, "executed": False}


@router.post("/automations/{request_id}/approve")
def approve_automation(request_id: int, who: Who, session: Database):
    require_role(who, "admin")
    request = session.scalar(select(AutomationRequest).where(
        AutomationRequest.id == request_id,
        AutomationRequest.organization_id == who.organization_id,
    ).with_for_update())
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.requested_by == who.subject:
        raise HTTPException(status_code=403, detail="Requester cannot approve own request")
    if request.status != "pending":
        raise HTTPException(status_code=409, detail="Already reviewed")
    # Approval is only a state transition. No external commands or scripts are executed.
    request.status = "approved"
    request.reviewed_by = who.subject
    record(session, request.ticket_id, who, "automation_approved", request.playbook)
    session.commit()
    return {"id": request.id, "status": request.status, "executed": False}


@router.get("/tickets/{ticket_id}/audit")
def audit(ticket_id: int, who: Who, session: Database):
    get_ticket(session, ticket_id, who)
    events = session.scalars(select(AuditEvent).where(
        AuditEvent.organization_id == who.organization_id,
        AuditEvent.ticket_id == ticket_id,
    ).order_by(AuditEvent.id.desc())).all()
    return [{"action": e.action, "actor": e.actor, "detail": e.detail,
             "created_at": e.created_at.isoformat()} for e in events]
