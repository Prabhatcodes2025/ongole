# Production operations runbook

## Deployment

1. Run `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`.
2. Apply Supabase migrations in filename order through `202607180003_auth_session_rbac_hotfix.sql`, then run the idempotent `supabase/seed.sql`.
3. Configure Vercel variables from `.env.example`; never place secrets in `NEXT_PUBLIC_*` variables.
4. Deploy with standard Next.js settings: `pnpm build`, default output and Node.js 22.
5. Verify `/api/health` reports `database: schema_ready`, then verify `/robots.txt`, `/sitemap.xml`, authentication, enquiry and property submission.

`NEXT_PUBLIC_SITE_URL` is currently `https://ongole.vercel.app`. When the custom domain is connected, update this variable and the matching Supabase Auth Site URL/redirect allow-list, then redeploy. No source change is required.

Supabase Authentication > URL Configuration:

- Site URL: `https://ongole.vercel.app`
- Redirect URLs: `https://ongole.vercel.app/auth/callback`, `https://ongole.vercel.app/**`, `http://localhost:3000/auth/callback`, and `http://localhost:3000/**`

After deployment, sign in as the intended administrator and open `/api/auth/context`. The response must contain the `super_admin` role and the expected permission codes. If roles are empty, assign `super_admin` using the documented SQL bootstrap; changing `profiles.account_type` does not grant RBAC permissions.

## Database and storage validation

- Confirm every migration appears in Supabase migration history.
- Review RLS policies for properties, profiles, enquiries, media, masters, advertisements, analytics and audit logs.
- Confirm anonymous users can select only published safe property columns and active approved campaigns.
- Confirm the `property-media` bucket is private and signed URLs expire.
- Confirm owner paths are scoped to the authenticated owner and property.
- Confirm uploaded media creates a display WebP plus a private thumbnail WebP and that deleting media removes both objects.
- Run `EXPLAIN (ANALYZE, BUFFERS)` for representative public location, price, area and title searches.

## Backups

- Enable Supabase daily backups or Point-in-Time Recovery for the production plan.
- Export a monthly logical backup with `pg_dump` and store it encrypted in a separate provider/account.
- Back up private storage objects separately; database backups do not contain Storage object bytes.
- Record backup timestamp, project, schema version, checksum, encryption key owner and retention expiry.
- Retain at least 7 daily, 4 weekly and 12 monthly restore points, subject to legal policy.

## Restore verification

1. Restore the latest backup into an isolated non-production Supabase project.
2. Apply only migrations newer than the backup schema version.
3. Restore storage objects and verify bucket privacy/policies.
4. Run counts and integrity checks for profiles, properties, media, enquiries, audit logs and advertisements.
5. Run application smoke tests using temporary credentials.
6. Record recovery point objective, recovery time and discrepancies. Test quarterly.

## Disaster recovery

- Freeze writes or switch the site to a maintenance response when data integrity is uncertain.
- Preserve logs and identify the last known-good backup before restoring.
- Rotate service-role, SMTP, Redis, Turnstile and monitoring credentials after a compromise.
- Reconnect Vercel only after RLS, storage, health and smoke checks pass.
- Document the incident timeline, affected records, notification decisions and corrective actions.

## Monitoring

- Poll `/api/health` from an external uptime service every five minutes.
- Alert on repeated 5xx responses, database degradation, email failures and rate-limit anomalies.
- Use the returned/request `x-request-id` to correlate platform and provider logs.
- Structured server events are JSON. `SENTRY_DSN` is surfaced as a readiness state until the production Sentry project/SDK is enabled.

## Rollback

- Roll back the Vercel deployment to the previous known-good build if application behavior regresses.
- Do not reverse the corrective migration by dropping data or policies. Apply a new forward-only migration after review.
- If the schema probe is unavailable during a staged rollout, health returns `reachable` with HTTP 503; deploy/apply the missing migration rather than weakening the check.
- Preserve database and Storage backups before any corrective data operation.
