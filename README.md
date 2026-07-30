# OngoleProperty.com

Production Next.js application for OngoleProperty.com, using Supabase for authentication, PostgreSQL data, row-level security and private property media.

## Requirements

- Node.js 22.x
- pnpm 11.x
- A Supabase project

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm verify:production
```

## Vercel

The repository uses the standard Next.js commands:

- Build command: `pnpm build`
- Output: Next.js default
- Install command: `pnpm install`
- Node.js: 22.x

Add the variables documented in `.env.example` to the Vercel project. Apply the SQL files under `supabase/migrations` to the production Supabase project in filename order before enabling authenticated workflows. Run `pnpm verify:production -- --environment` in a production-configured environment to fail closed on missing launch variables.

## Supabase rollout

Apply migrations in filename order, ending with `supabase/migrations/202607180003_auth_session_rbac_hotfix.sql`, then run `supabase/seed.sql`. The auth hotfix adds safe missing-profile reconciliation, current-user RBAC diagnostics, explicit operational grants and the missing master-data administration policies. Create the first super admin only after the schema and RBAC seed are applied.

Supabase Authentication URL Configuration must use `NEXT_PUBLIC_SITE_URL` as the Site URL. For the current deployment, allow `https://ongole.vercel.app/auth/callback` and `https://ongole.vercel.app/**`; local development uses the equivalent `http://localhost:3000` callback/paths. Confirmation and recovery emails return through `/auth/callback`, where the PKCE code is exchanged for the server cookie session.

## Optional production services

- SMTP delivery is enabled only when all `SMTP_*` variables and `ADMIN_NOTIFICATION_EMAIL` are configured.
- `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are required server-only variables for the authenticated Vercel maintenance job. The service role must never use a `NEXT_PUBLIC_*` name.
- Turnstile is enabled only when both CAPTCHA keys are configured.
- Distributed rate limiting requires an HTTPS Redis REST endpoint in `REDIS_URL` plus `REDIS_TOKEN`; local development safely falls back to in-memory limits.

## Public data behavior

Public pages query only approved, published, non-deleted Supabase records. When Supabase is not configured, the homepage and catalogue use clearly marked demo previews; demo detail pages are `noindex` and are excluded from the sitemap. Private property images are exposed only through short-lived signed URLs.

The latest migrations add normalized area filtering, anonymous column restrictions, protected premium map access, dynamic master data, operational CRM, owner lifecycle actions and transactional admin controls.

See `docs/SPRINT-1.md` and `docs/SPRINT-2.md` for completion checklists, configuration blockers and manual production verification steps.

## Sprint 3 production readiness

Sprint 3 implements the complete client homepage audit, local `Gadi = square feet / 72` conversion, master-backed location suggestions, approved campaign advertisements, search analytics/indexing, expanded SEO metadata, request IDs, structured health reporting, GA4 and production runbooks.

Apply `supabase/migrations/202607180001_sprint3_production_readiness.sql` after the Sprint 2 migration. Empty advertisement positions never render; campaigns must be approved, inside their schedule and use an image hosted in the configured Supabase project.

See `docs/SPRINT-3.md`, `docs/SPRINT-3-PRODUCTION-ACCEPTANCE.md` and `docs/PRODUCTION-RUNBOOK.md` for the implementation checklist, acceptance evidence and operational procedures. The current canonical origin is `https://ongole.vercel.app`; changing `NEXT_PUBLIC_SITE_URL` to the custom domain requires a Vercel redeploy but no code change.

Use `pnpm verify:auth` only with disposable normal-user and administrator credentials supplied through the `AUTH_TEST_*` environment variables. It never creates users, grants roles, prints tokens or performs destructive writes.
