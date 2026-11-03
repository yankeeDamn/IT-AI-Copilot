# IT-AI-Copilot — Next.js dashboard (PR #5)

A responsive, server-mediated front end for the existing FastAPI IT Operations Copilot.
**This is a draft feature** and is not deployed, merged, or production-ready.

## What works

- OIDC login through Auth.js v5 authorization-code flow with PKCE and state checks.
- Dashboard requires a signed-in session; role and organization membership are verified by Python on every API call.
- Ticket list, search, status filter, creation, assignment, priority and status changes.
- ML classification and AI troubleshooting with clear human-review guidance.
- Demonstration knowledge search with explicit source files.
- Analytics (ticket distribution, activity, mean time to resolution).
- Admin-only approval inbox; requester cannot self-approve. No script execution.
- Responsive sidebar on desktop, mobile navigation, and loading/error states.

## Architecture: tokens never exposed to browser JS

```text
Browser (Auth.js encrypted HttpOnly session cookie)
   -> Next.js same-origin /api/copilot/v1/organizations/{id}/...
     -> Auth.js JWT token extraction server-side
       -> restrictive path and method allowlist / Origin check on writes
         -> HTTPS FastAPI (OIDC RS256 issuer + audience validation)
           -> database-backed organization membership / permissions
```

Auth.js keeps the provider's access token inside its encrypted session cookie; the public
session callback does NOT return that token to the browser. The Next.js route forwards it
as a bearer only to the server-configured FastAPI URL. Backend authorization is always
authoritative; client role checks only hide prohibited controls. Login is not functional until
a real OIDC provider and API audience/scope are configured.

**Important:** provider access token must have the exact `OIDC_AUDIENCE` required by
the Python API (ID tokens cannot be substituted). The OIDC identity provider's custom API scope,
resource/audience and signing algorithm (RS256) must match FastAPI's configuration.
The frontend does not refresh expired API access tokens yet: users sign in again.

## Windows PowerShell

From repository root, first prepare backend and database using root `README.md`.
In a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
# Fill AUTH_SECRET (npx auth secret), OIDC_* and COPILOT_API_BASE_URL in .env.local
npm test
npm run build
npm run typecheck
npm run dev
```

Visit http://localhost:3000. Configure your identity provider's redirect/callback URL to
`http://localhost:3000/api/auth/callback/corporate-oidc` for local use.
An admin must provision membership using `scripts/bootstrap_org.py` or another trusted
administrator workflow. Enter your authorized numeric organization ID at `/dashboard`.

Never commit `.env.local` or put OAuth client secrets in `NEXT_PUBLIC_*`.
For production, use HTTPS and server-only secrets and an internal private API URL, and
configure `AUTH_TRUST_HOST` only for a trusted reverse proxy deployment.

## CI and tests

`frontend.yml` runs API bridge allowlist/origin/token tests, a Next build and strict
TypeScript validation. Python CI remains separate and validates PostgreSQL/Alembic and
organization authorization. No real OAuth credentials are used in CI.

## Known limitations

- Organization ID entered manually; membership discovery and admin user onboarding are future work.
- UI only shows the most recent 100 tickets because the backend API currently limits its list.
- Demo TF-IDF documents only (no private tenant RAG ingestion or permissions).
- Local chart summaries only; verified classification accuracy is not available.
- Access-token refresh, CSRF hardening for multi-domain proxy setups, rate limiting,
  real provider end-to-end login tests, accessibility audit and production observability
  must be completed before opening access to customers.
- No Azure resources have been provisioned. Local development costs $0 of Azure credits.
