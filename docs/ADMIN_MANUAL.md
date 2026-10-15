# OngoleProperty Administration Manual

This manual describes the controls present in the application. Production access depends on the Supabase role and permission assignments applied to the signed-in account.

## Login and roles

Sign in at `/login`, then open `/admin`. The interface reads `get_current_auth_context`; it does not infer administrator access from the profile account type. `super_admin` is displayed as Super Administrator and `admin` as Administrator. Administrator accounts cannot self-deactivate. Role changes must be deliberate and audited.

## Properties

Open `/admin/properties` to filter all lifecycle states, including draft, pending review, changes requested, approved, published, rejected, archived and soft-deleted records. Open a record to review its owner, submitted fields, media state, status history and audit trail. The administrator edit control opens the existing full property form. Owners may edit only draft or changes-requested records; a user with `properties.manage` may edit the full record.

Approve and reject only pending records. Rejection and requests for changes require a reason. Approval does not make a listing public: use Publish after approval. Archive/unpublish removes a listing from the public catalogue. Restore changes a soft-deleted archived listing back to a private draft. Priority Listing, feature, pin, contact and map visibility controls are audited.

Public catalogue queries require an allowed public status and `deleted_at is null`. Pending, draft, rejected, changes-requested, approved and archived records are not public.

## Paying Guest listings

Open `/admin/pg`. PG lifecycle is stored on the linked property record. Review, approve, reject, request changes and publish from the PG review page. The full edit form is `/dashboard/pg/{pg-id}` and accepts authorized administrators; normal owners remain restricted to their own draft or changes-requested records. Room and media changes should be completed before publication.

## Agents

Open `/admin/agents` to search applications and filter pending, active, rejected, suspended or blocked states. Users with `agents.manage` can approve or reject pending applications; rejection requires a reason. Full-field editing is available at `/admin/agents/{agent-id}` and requires an audit reason. Public agent eligibility is never granted before approval.

## Enquiries and NRI services

Open `/admin/enquiries` for CRM status, priority, assignment, notes and follow-up dates. NRI forms are saved with source `nri_services`; use `/admin/enquiries?service=nri` to isolate them. NRI country-code fields are operational data and are not copied into analytics events.

## Promotions, advertisements and billing

Use `/admin/promotions`, `/admin/advertisements` and `/admin/billing`. Availability depends on the corresponding role permissions. Plans, subscriptions, captured payments, manual payments, invoices and refunds remain in their existing modules. Do not treat a payment as captured until its stored status confirms it.

## Analytics

Open `/admin/analytics`. Choose From and To dates, then Apply. The page reports actual collected events only: visitors, visits, approximate country/region/city, listing views, searches, enquiries, phone and WhatsApp actions, service and source breakdowns, landing pages and property engagement. New dimensions begin accumulating only after the launch analytics migration; no historical values are invented.

First-party analytics uses a daily rotating one-way session hash and hosting-provider approximate location headers. It must not store passwords, OTPs, payment details, private messages or precise GPS. Landing paths and campaign values are length-limited. Retain raw events only for the approved business period; a 13-month maximum is recommended, with aggregated reports retained according to the privacy policy.

## Meta Pixel

The site uses the existing Pixel/Dataset ID `723324339565605`. Meta scripts load only after the visitor selects Allow analytics. PageView, ViewContent, Search, Contact, Lead and privacy-safe custom WhatsApp, map and form events are emitted once per interaction. No access token is present in client code. Conversions API is not enabled until a server-side Meta access token, dataset access, consent policy and event-id deduplication validation are supplied.

## Deletion and restore

Soft delete is the normal administrative action and is recoverable through Restore. Permanent deletion is intentionally unavailable until a written retention/backup period and dependent-record procedure are approved. Never bulk-delete real user data. Do not delete or deactivate an administrator account through ordinary user controls.

## Account safety

Use individual administrator accounts, MFA in the identity provider, least-privilege roles and short sessions on shared computers. Never share Supabase service-role, SMTP, payment, Meta or CAPTCHA secrets. Review `/admin/audit` after privileged changes.

## Troubleshooting

- If Home falls back to an empty/latest view, check Supabase reachability and the public catalogue query; the page has a bounded wait.
- If Google sign-in times out, use password sign-in, then verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, authorized origins and Supabase Google provider settings.
- If a posting limit appears for an administrator, apply `202610140001_launch_admin_rbac_analytics.sql` and verify the role grants `properties.manage` or `pg.manage`.
- If analytics dimensions are empty, apply both analytics migrations and confirm consent plus `/api/analytics/events` responses.
- If images fail, verify the `property-media` storage policies, size/type limits and processing status.
- For an error with a request ID, use server logs and the protected audit log; do not ask the user to send passwords or OTPs.
