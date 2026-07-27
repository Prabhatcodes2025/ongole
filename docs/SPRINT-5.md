# Sprint 5 — memberships, monetization, notifications and analytics

## Delivered architecture

Sprint 5 extends the existing Next.js/Supabase application without replacing the Property, PG, authentication or approval modules. Property and PG owners share one authenticated dashboard shell; administrators use the same component system with permission-aware navigation and actions.

The forward-only migration is `supabase/migrations/202607280001_sprint5_memberships_monetization.sql`. It adds configurable plans and features, subscriptions and usage, provider-neutral orders and transactions, invoices and refunds, manual payment review, time-bound promotion activations, notification records and delivery queues, and daily analytics aggregates.

## Workflows

- Subscription: an authenticated owner selects an active database-backed plan. The server calculates the amount and creates the provider order. A browser checkout result never activates a plan. A signature-verified, idempotent webhook captures the payment and activates the subscription atomically. Administrators can perform permission-protected subscription actions.
- Manual payment: the owner selects a plan and uploads proof to the private `payment-proofs` bucket. A finance-authorized administrator approves, rejects or requests clarification. Approval uses the same protected activation function and records an audit event.
- Promotion: owners can purchase an active promotion product or claim an available featured/verified plan allowance. Every promotion has an activation interval and status. A scheduled database job expires records and refreshes derived listing flags.
- Notifications: listing, enquiry, subscription, payment and promotion events create an in-app notification and queue optional email delivery. Notification creation catches delivery-record failures so it cannot roll back the primary workflow.
- Analytics: public events are rate limited and resolve the published listing server-side. The stored fingerprint is privacy-safe. Owners query only their own listing IDs; administrators require `analytics.read`. Daily aggregation keeps dashboards efficient.
- Reports: administrators require both `reports.read` and the relevant module permission. Owner reports remain owner-scoped. Exports support date, status and plan filters, formula-safe CSV, XLSX and audit logging.

## Security controls

- RLS is enabled on every new user-data table.
- No anonymous write grants are added.
- Ownership is derived from `auth.uid()` and privileged states cannot be selected by browser input.
- Payment secrets and the service-role key remain server-only.
- Webhook signatures use the unmodified raw request body; event IDs and payload hashes provide replay protection.
- Plan limits are enforced by server RPC checks and database triggers for listing creation, publication and image upload.
- Finance, plan, report, analytics and promotion actions use canonical RBAC permissions.
- `SECURITY DEFINER` functions set a safe search path.
- Trigger timestamp changes modify `NEW`; explicit updates are row-bounded.
- Invoice and payment-proof access is authenticated and ownership/permission protected.

## Scheduled operations

Invoke these database functions from a trusted Supabase Cron/pg_cron job or protected operations runner:

- `select public.aggregate_analytics(current_date - 1);` daily after UTC midnight.
- `select public.enqueue_expiry_notifications();` daily.
- `select public.expire_promotions();` at least hourly.

Do not expose these operations as anonymous endpoints.

## Required environment variables

In addition to the existing variables:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

When these are absent, online checkout is cleanly disabled and manual payment remains available. Never prefix secrets with `NEXT_PUBLIC_`.

## Production acceptance checklist

- Apply migrations in filename order and verify the seed.
- Configure a Razorpay webhook for `/api/payments/webhooks/razorpay`.
- Test a provider payment with a real signed sandbox webhook, duplicate delivery and invalid signature.
- Test private proof upload, admin review and resulting subscription.
- Confirm plan limits for Property, PG and media with disposable accounts.
- Confirm owner analytics isolation and read-only admin action visibility.
- Run the three scheduled functions and confirm expiry/aggregation results.
- Complete browser and production acceptance before declaring live readiness.
