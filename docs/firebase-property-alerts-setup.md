# Property-wise smart push: external setup (Phase 1)

Code and migration preparation do not configure Firebase. Apply `supabase/migrations/202609150001_property_smart_push_phase1.sql` to the intended Supabase project before enabling the feature. Keep the Vercel maintenance cron and `CRON_SECRET` configured; the database publish outbox is durable, but delivery is a bounded post-response attempt with a daily cron retry, **not** an instant, dedicated worker. At scale, a higher-frequency authorized queue runner is needed for low-latency delivery.

## Firebase Console

1. Create/select the Firebase project, register the `https://ongoleproperty.com` Web App, and enable Cloud Messaging.
2. In Cloud Messaging, generate a Web Push certificate/key pair. Copy the **public VAPID key**, not a private key, to `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
3. Copy the Web App identifiers to the matching `NEXT_PUBLIC_FIREBASE_*` variables in `.env.example`. An API key in Firebase web config is a public app identifier, but restrict it to the intended APIs and origins in Google Cloud.
4. Create a least-privilege Firebase Admin service account for Cloud Messaging. Store the project ID, client email, and private key in Vercel encrypted server-side environment variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Preserve private-key newlines (literal newlines or escaped `\n`). Never commit service-account JSON or place these values in `NEXT_PUBLIC_*`.
5. Deploy only after a reviewed migration and environment setup. Confirm `/firebase-messaging-sw.js` serves JavaScript from the production origin over HTTPS and its scope is `/`. Its public Firebase config is emitted by the application. Existing service workers must not claim a conflicting scope.

The browser asks permission only after clicking **ENABLE PROPERTY ALERTS**. The app gracefully declines when config, secure context, browser support or permission is unavailable. Test Chrome/Edge desktop and supported Android browsers; iOS/iPadOS support depends on installed Home Screen web apps and platform versions. Do not assume every browser supports Web Push.

## Delivery and security

- A database trigger records only the first transition to `published` with a new `published_at`; ordinary edits, approvals, drafts and repeated publishes do not enqueue a new job.
- The Admin publish route makes a bounded post-response attempt. Daily authenticated maintenance cron retries queued/failed-transient work. No Firebase send occurs inside the publish transaction.
- Jobs scan requirements in batches of 50; each processor pass handles at most two jobs and ten sends. The outbox persists until processed, but this design has no dedicated worker or guaranteed instant fan-out. Monitor queued/failed rows and cron logs.
- Matches use transaction, catalog category/type, known location, budget, optional area and BHK. Empty optional filters are wildcards. One property/registration has one dedupe key. Automatic sends are limited to three distinct properties per user per rolling 24 hours; paused, disabled, revoked and inactive registrations are re-checked before delivery.
- The private property-media bucket uses expiring signed URLs. Phase 1 deliberately uses the bundled OngoleProperty logo for push notifications rather than embedding fragile or leaked signed image URLs.
- Only authenticated users can manage their own requirements and read their own logs. Server-side service role writes tokens, outbox and delivery logs; Admin manual sends require `notifications.manage`, a typed confirmation, a server-side rate limit, and an audience cap. The Admin UI does not expose FCM tokens.

After external setup, test one account with two browsers, token rotation, sign-out, denied/revoked permission, a new publish, PG publish, Admin manual sends, and a failed-token retry. Do not add Firebase private keys to `.env.example`, commits, client bundles, or browser logging.
