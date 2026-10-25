# IT-AI-Copilot — Week 4 Secure Backend

Python IT Operations Copilot: ML ticket classification, OIDC-protected ticket management,
tenant-isolated PostgreSQL persistence, knowledge search, optional Azure OpenAI suggestions,
and separate-person automation approval **recording only**.

## Architecture and security

- **Authentication:** HTTPS OIDC issuer, RS256 JWT, JWKS signature verification, issuer,
  audience, expiration and required claims; bearer tokens are not API keys.
- **Authorization:** Database-backed memberships with viewer, technician, admin roles.
  Every ticket, dashboard and audit query is scoped to the authenticated organization.
- **Automation:** A technician or admin may request an allowlisted playbook. A *different*
  admin in the same organization must approve it. No script execution is implemented.
- **Persistence:** SQLAlchemy + Alembic, PostgreSQL through psycopg 3. SQLite is used in
  isolated automated tests. Existing Week 3 SQLite databases are **not automatically migrated**.
- **ML:** Synthetic-ticket model with group-aware holdout; uncalibrated confidence.
- **AI:** Azure OpenAI is optional. Do not send sensitive production tickets without approved
  privacy controls. Knowledge files are bundled demonstration articles only.

## Windows PowerShell local setup

Install Python 3.12, Git and Docker Desktop. From the project folder:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
$env:POSTGRES_PASSWORD = "choose-a-local-password"
docker compose up -d postgres
$env:DATABASE_URL = "postgresql+psycopg://copilot:choose-a-local-password@127.0.0.1:5432/copilot"
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe scripts/train.py
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn it_ai_copilot.api:app --reload
```

Set `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URI` to a configured identity
provider that issues **RS256 API access tokens** for the intended audience. An identity
provider must be configured separately; no hosted login UI is included. An OIDC *ID token*
is not a substitute for an API access token. The API fails closed without OIDC configuration.

Provision the initial admin with a trusted, issuer-prefixed subject obtained from the
provider, not from arbitrary client input:

```powershell
.\.venv\Scripts\python.exe scripts/bootstrap_org.py --slug demo --name "Demo IT" --subject "https://your-issuer|actual-sub"
```

Read the printed organization ID and call `/v1/organizations/{organization_id}/tickets`
with `Authorization: Bearer <access_token>`. Swagger docs: http://127.0.0.1:8000/docs.
Membership management for other users is not yet exposed through an API: provision
membership records through a trusted administrative process.

## API and tests

The organization-scoped routes are `/v1/organizations/{organization_id}/tickets`,
`/tickets/{ticket_id}/classify`, `/tickets/{ticket_id}/suggest`,
`/knowledge/search`, `/dashboard/summary`,
`/tickets/{ticket_id}/automations`, `/automations/{request_id}/approve`,
and `/tickets/{ticket_id}/audit`. The standalone `/v1/predict` endpoint also
requires a signed bearer token.

Run `ruff check .`, `pytest -q`, and `alembic upgrade head`. Tests use
cryptographically signed local RSA test tokens; no production authentication bypass.

## Database migration warning

Migration `0001_secure_tenants` is a **new-install schema**. Back up any Week 3
SQLite database before upgrading; it has a different schema and requires an
explicit data conversion plan. Never point Alembic at an existing SQLite database
containing unscoped tickets and assume it will upgrade in place.

## Azure and the $200 credit

Keep training local. Use local Docker PostgreSQL for development and do not
provision Azure PostgreSQL or Azure OpenAI until needed. Prefer Container Apps
with scale-to-zero where supported, set cost alerts and cap AI usage. Azure
budget alerts are **not** hard spending limits. Production requires managed
secrets, TLS, migrations run as one deployment job, backups, monitoring and
rate limits. The included Docker entrypoint runs migrations on startup and is
for a single-instance development deployment, not concurrent production replicas.

## Remaining limitations

No frontend or login redirect flow, membership administration UI, tenant-aware
private document ingestion, user-level audit immutability, rate limits, migration
from old SQLite data, or real automation execution. This is not yet production-ready.
