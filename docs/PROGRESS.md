# OngoleProperty.com implementation progress

Last audited: 16 July 2026

This checklist reflects the repository itself. “Completed” means implemented and passing the available local gates; external Supabase/provider/VPS activation is listed separately and is not claimed as complete.

## ✅ Completed

- Repository and all supplied Word requirements audited. The latest pasted brief controls where older documents conflict: Supabase PostgreSQL replaces MongoDB, multiple-admin RBAC replaces single-admin scope, packages stay hidden, and publication remains manually approved.
- Existing Next.js 16 + TypeScript site preserved: supplied branding, logo, responsive header/footer, homepage, search UI, listing cards, public content pages and responsive layouts.
- Public listing and property-detail route structure, canonical metadata, Open Graph basics and property JSON-LD foundation.
- Supabase server client and environment validation; no fake success responses when services are unconfigured.
- Supabase core migration: profiles, RBAC, reference data, properties, media, status history, enquiries, agents, PG, memberships, payments, SEO overrides, URL history, flags/settings, notifications, audit and analytics.
- Database indexes, timestamps, triggers, RLS policies, permission checks, protected owner-contact function, transactional submit/review functions and initial seed data.
- Supabase email/password register, login and logout API routes with validation and rate-limit hooks.
- Authenticated owner dashboard, property draft creation, draft detail, submission lock and manual review transition.
- Permission-protected admin dashboard, approval queue, property review screen and server-side status enforcement.
- Secure property-image pipeline: private Storage bucket policies, owner/status checks, origin check, type/size/pixel limits, Sharp decode, resize, WebP conversion, watermark, cover selection, 20-image cap and storage rollback on database failure.
- Enquiry API with validation, rate limiting, CAPTCHA verification hook and notification-outbox trigger.
- Platform response security headers and a database-aware `/api/health` endpoint.
- Dependency/lockfile recovery after the interrupted install.
- Local quality gates: TypeScript passes, ESLint passes, production build passes, and 2 production-focused Node tests pass.

## 🟡 In Progress

- Replace public sample listing data with live, paginated Supabase queries and signed media URLs.
- Complete owner draft editing, image reorder/delete/cover/alt-text controls and admin media moderation.
- Complete admin modules beyond the working approval queue: enquiries, users, role assignment, agents, PG, memberships, settings, SEO, redirects, analytics, audit and system health.
- CAPTCHA browser widget, Redis-backed distributed rate limiting and full brute-force protection. Server verification and local rate-limit scaffolding are present.
- Dynamic sitemap groups, robots controls, automatic URL-history redirects and database SEO overrides. Canonical/page metadata foundation is present.
- Email provider worker, retry/dead-letter processing and templates. Database outbox creation is present.
- Broader unit, integration, RLS and end-to-end coverage. Current smoke/security tests pass.

## ❌ Not Started

- CSV/Excel exports with spreadsheet-formula sanitisation.
- Membership payment-provider integration and reconciliation workflow.
- Social-preview artwork and final image/visual accessibility QA.
- Docker image, Compose stack, Nginx TLS/proxy configuration, VPS deployment scripts, backup/restore drills and rollback runbook.
- Production environment activation: apply migrations/seed to the real Supabase project, configure secrets and providers, create the first super admin, run RLS integration tests, and deploy.

## Verification snapshot

```text
tsc --noEmit                         PASS
eslint .                             PASS
node --test tests/**/*.test.mjs      PASS (2/2)
next build                           PASS
```
