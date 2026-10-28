"""Explicit operator bootstrap; requires a verified issuer-prefixed subject.

Example:
python scripts/bootstrap_org.py --slug demo --name "Demo IT" --subject "https://issuer.example|user-id"
"""
from __future__ import annotations

import argparse

from sqlalchemy import select

from it_ai_copilot.store import Membership, Organization, session_factory


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--subject", required=True, help="OIDC_ISSUER|sub")
    args = parser.parse_args()
    if "|" not in args.subject or not args.subject.startswith("https://"):
        parser.error("Subject must be formatted as https://issuer|sub")
    with session_factory()() as session:
        organization = session.scalar(select(Organization).where(Organization.slug == args.slug))
        if organization is None:
            organization = Organization(slug=args.slug, name=args.name)
            session.add(organization)
            session.flush()
        existing = session.scalar(select(Membership).where(
            Membership.organization_id == organization.id, Membership.subject == args.subject
        ))
        if existing is None:
            session.add(Membership(
                organization_id=organization.id, subject=args.subject, role="admin", active=True
            ))
        session.commit()
        print(f"Organization ID: {organization.id}; administrator membership provisioned.")


if __name__ == "__main__":
    main()
