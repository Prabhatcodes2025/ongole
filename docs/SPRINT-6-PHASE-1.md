# Sprint 6 Phase 1 — launch-critical completion

## Implemented scope

- All nine client policy routes are canonical, included in the sitemap and linked from the footer.
- Property contact eligibility uses the active Sprint 5 subscription period.
- The homepage hero is shorter, responsive and reduced-motion aware.
- Vercel runs one authenticated daily maintenance job for expiry notices, promotion expiry, analytics aggregation and email queue delivery.
- Indian mobile numbers are normalized, validated and unique across profiles.
- The non-functional property Save control was removed.
- Gallery focus handling, slider controls, form help text, landmarks and legal-page semantics were reviewed for keyboard and screen-reader use.

## Required production configuration

1. Apply `202607300001_sprint6_launch_security.sql`, followed by `202607300002_sprint6_notification_scheduler.sql`.
2. Configure `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM_EMAIL` as server-only Vercel variables.
3. Keep `NEXT_PUBLIC_SITE_URL` aligned with the canonical production domain and Supabase Auth redirect allow-list.
4. Run `pnpm verify:production -- --environment`, then deploy the standard Next.js build.
5. Trigger the maintenance cron once and confirm its JSON response and `cron.maintenance_completed` log entry.

## Acceptance checks

- Register and profile update reject invalid or already-used mobile numbers without exposing the matching account.
- A published listing with `eligible_members` contact visibility reveals the owner contact only under the active Sprint 5 subscription rule.
- Email-only notification preferences enqueue a linked, non-visible notification and the worker sends it once.
- Failed deliveries retry with backoff, stop after five attempts and recover claims abandoned for more than 15 minutes.
- Every legal footer link returns a canonical policy page.
- At mobile, tablet and desktop widths, the homepage has no horizontal overflow, controls remain keyboard reachable, visible focus is retained and reduced-motion users can stop automatic rotation.

## Verification evidence

- Clean `pnpm install --frozen-lockfile`: passed with the pinned pnpm 11.9.0 lockfile.
- Standard `next build`: passed and emitted `/api/cron/maintenance` plus all public, owner and administrator routes.
- Responsive production-build smoke test: no horizontal overflow at 390×844, 768×1024 or 1440×900. Hero height was 730, 650 and 510 pixels respectively.
- Accessibility smoke test: one homepage H1, a main landmark, skip link, labelled search controls, controllable slider rotation and all nine legal links were exposed in the accessibility tree.
- Privacy page smoke test: canonical URL, one H1 and ordered H2 policy sections were present.
- Unauthenticated scheduler request: returned HTTP 401 and emitted `cron.unauthorized`.

## Legal review boundary

Terms and Conditions, Privacy Policy, Disclaimer, Copyright Policy and Contact/Grievance content follow the supplied client document. Property Listing, Membership, Advertisement and Cookie policies are implemented as launch-ready operational text but still require the client's final legal sign-off before the custom-domain launch.
