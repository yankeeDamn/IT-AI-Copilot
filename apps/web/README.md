# IT-AI-Copilot — Next.js 15 Enterprise Web Foundation

This workspace lives **inside the existing Python repository**. The Python/FastAPI ML service
is preserved. Prisma owns the PostgreSQL `itsm` schema; the original Alembic backend owns
the `public` schema. Do **not** point Prisma migrations at existing Python tables.

### Implemented now

- Next.js 15 App Router + strict TypeScript + Tailwind CSS v4
- Auth.js with Microsoft Entra ID and Google (requires provider configuration)
- Prisma database-adapter sessions; no anonymous tenant access
- Organization-based membership and role checks on every implemented query
- Ticket list, creation, read/detail and staff ticket status updates
- Responsive dashboard, real status metrics and status distribution chart
- Basic Shadcn-style button/card/badge, theme switching, loading/error states
- Complete enterprise data-model **schema** and architecture/API/RBAC reference
- API contract tests, lint/typecheck and GitHub Actions checks

The assets, knowledge, AI chat, monitoring, reports and admin pages display clearly
labeled **planned modules**. They do not pretend to contain working functionality.
Credentials login, password reset and MFA self-enrollment are also not implemented:
use managed identity providers with provider-enforced MFA.

### Windows PowerShell

```powershell
git clone https://github.com/yankeeDamn/IT-AI-Copilot.git
cd IT-AI-Copilot
git switch feature/phase5-enterprise-platform-foundation
cd apps/web
npm install
Copy-Item .env.example .env.local
```

Set `ITSM_DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `APP_ORIGIN` and the selected
provider OAuth client ID/secret/issuer in `.env.local`. For local PostgreSQL, start
the **existing root** `docker compose up -d postgres` using a development
`POSTGRES_PASSWORD` environment variable. Prisma must not touch the existing `public`
tables. First migration is **not yet committed**: generate it against a disposable
PostgreSQL database, inspect SQL and approval boundaries, then apply it.

```powershell
npx prisma validate
npx prisma generate
npm run typecheck
npm run lint
npm test
npm run dev
```

For an actual populated application, first create and review the Prisma initial migration,
configure OAuth redirect URLs (typically `/api/auth/callback/microsoft-entra-id` or
`/api/auth/callback/google`), sign in once, and run the explicit trusted
`npm run db:seed` with `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ORG_SLUG`,
`BOOTSTRAP_ORG_NAME`. The seed refuses to grant admin to a non-existent account.

### Security & release constraints

- Cookies: Auth.js database session; all business queries verify current membership.
- Role access is currently derived from a **code policy table**. RolePermission data is
  seeded for next phase, but dynamic permission enforcement is not yet enabled.
- Only the first active membership is selected; org switching and explicit access scopes
  are a Phase 5B requirement. Technicians can see unassigned or assigned/own tickets.
- Explicit CSRF Origin checks for mutation routes; server-side Zod validation; no
  private secrets in browser bundles.
- No file upload/download, public contact center, advanced reporting, semantic RAG or
  outbound integrations implemented.
- No production rate limiting, verified 1,000-user load test, disaster recovery or
  penetration audit yet. Do not call this release production ready.
- The AI integration with the existing FastAPI service requires a dedicated secured
  service-to-service bridge; it is not silently bypassing the Python OIDC authentication.
- Do not merge or deploy this PR until CI passes and the initial SQL migration and
  application threat model are reviewed.

### Azure $200 budget

No Azure resources needed to run tests. Do not provision Container Apps, managed
PostgreSQL, monitoring clusters or GPT-4o until a budget and staging rollout are approved.
A GitHub Actions migration draft is an **artifact for review**, not an applied migration.
