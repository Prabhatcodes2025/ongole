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
```

## Vercel

The repository uses the standard Next.js commands:

- Build command: `pnpm build`
- Output: Next.js default
- Install command: `pnpm install`
- Node.js: 22.x

Add the variables documented in `.env.example` to the Vercel project. Apply the SQL files under `supabase/migrations` to the production Supabase project before enabling authenticated workflows.

## Supabase rollout

Apply migrations in filename order, ending with `supabase/migrations/202607170004_sprint2_operations.sql`, then run `supabase/seed.sql`. Create the first super admin only after the schema and RBAC seed are applied.

## Optional production services

- SMTP delivery is enabled only when all `SMTP_*` variables and `ADMIN_NOTIFICATION_EMAIL` are configured.
- Turnstile is enabled only when both CAPTCHA keys are configured.
- Distributed rate limiting requires an HTTPS Redis REST endpoint in `REDIS_URL` plus `REDIS_TOKEN`; local development safely falls back to in-memory limits.

## Public data behavior

Public pages query only approved, published, non-deleted Supabase records. When Supabase is not configured, the homepage and catalogue use clearly marked demo previews; demo detail pages are `noindex` and are excluded from the sitemap. Private property images are exposed only through short-lived signed URLs.

The latest migrations add normalized area filtering, anonymous column restrictions, protected premium map access, dynamic master data, operational CRM, owner lifecycle actions and transactional admin controls.

See `docs/SPRINT-1.md` and `docs/SPRINT-2.md` for completion checklists, configuration blockers and manual production verification steps.
