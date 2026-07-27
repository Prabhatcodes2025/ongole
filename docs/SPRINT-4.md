# Sprint 4 — Paying Guest module

Implemented 27 July 2026.

## Architecture

Each PG listing has a one-to-one `properties` base row. The base row remains the source of truth for owner identity, reference number, slug, lifecycle status, review history, publication flags, soft deletion, media, enquiries, audit data and SEO publication state. `pg_listings` stores PG-specific details and `pg_room_types` stores independently searchable room inventory.

No service-role client is shipped to the browser. Owner and administrator pages use the authenticated server Supabase client and remain protected by RLS and RBAC. Public PG queries execute only on the server and explicitly require a published, non-deleted base property.

## Delivered

- Owner dashboard, create/edit, preview, duplicate, soft delete and submit-for-review workflows.
- PG categories, address/map coordinates, description, amenities, house rules, videos and private contact fields.
- Multiple single/double/triple/four-sharing room types with capacity, live beds, rent and deposit.
- Existing private property-media processing and ordering reused for PG images.
- Public paginated search by text, city, locality, budget, PG type, sharing, amenities and availability.
- Public gallery, room pricing, amenities, map, similar PGs, enquiry form, WhatsApp and call actions.
- Admin listing, review, approve, reject, request changes, publish, feature, verify, pin, soft delete and restore.
- Dynamic metadata, canonical URLs, OpenGraph, `LodgingBusiness` JSON-LD and sitemap entries.
- Forward-only migration with indexes, constraints, triggers, RLS, least-privilege grants and owner lifecycle RPCs.

## Lifecycle

`draft → pending_review → approved → published`

Administrators may instead move a pending submission to `changes_requested` or `rejected`. The existing `review_property` function remains the single approval engine. PG submission uses `submit_pg_for_review`, which requires a complete description, address and at least one room type.

## Production acceptance

1. Apply `202607270002_sprint4_paying_guest_module.sql`.
2. Sign in as a PG owner; create a draft and confirm one base property, one PG row and one initial draft-history row.
3. Add rooms and images, preview, edit and submit.
4. Sign in as an administrator with `pg.read` and `pg.manage`; request changes once, resubmit, approve and publish.
5. Confirm the public listing filters and detail page, then send an enquiry.
6. Exercise feature, verify, pin, soft delete and restore.
7. Confirm a second owner cannot read private contact data or mutate the listing.

The automated suite validates contracts and application integration. Authenticated production acceptance still requires deployed Supabase credentials and disposable owner/admin accounts.
