"""Strict OIDC JWT verification with database-backed organization membership."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from it_ai_copilot.store import Membership

ROLES = {"viewer", "technician", "admin"}
bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    subject: str
    organization_id: int
    role: str


@lru_cache(maxsize=8)
def jwks_client(uri: str) -> PyJWKClient:
    return PyJWKClient(uri, cache_jwk_set=True, lifespan=300, timeout=5)


def verified_subject(token: str) -> str:
    issuer = os.environ.get("OIDC_ISSUER", "").rstrip("/")
    audience = os.environ.get("OIDC_AUDIENCE", "")
    jwks_uri = os.environ.get("OIDC_JWKS_URI", "")
    if not issuer.startswith("https://") or not jwks_uri.startswith("https://") or not audience:
        raise HTTPException(status_code=503, detail="OIDC is not configured")
    try:
        key = jwks_client(jwks_uri).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token, key.key, algorithms=["RS256"], issuer=issuer, audience=audience,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]}, leeway=30,
        )
    except (jwt.PyJWTError, ValueError, OSError) as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise HTTPException(status_code=401, detail="Missing subject")
    return f"{issuer}|{subject}"


def principal_for_session(
    credentials: HTTPAuthorizationCredentials | None,
    session: Session,
    organization_id: int,
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer token required")
    subject = verified_subject(credentials.credentials)
    membership = session.scalar(select(Membership).where(
        Membership.subject == subject,
        Membership.organization_id == organization_id,
        Membership.active.is_(True),
    ))
    if membership is None or membership.role not in ROLES:
        raise HTTPException(status_code=403, detail="No active organization membership")
    return Principal(subject=subject, organization_id=organization_id, role=membership.role)


def require_role(principal: Principal, *allowed: str) -> None:
    if principal.role not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
