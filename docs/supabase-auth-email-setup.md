# Supabase Auth email setup

The application uses Supabase Auth to send two authentication emails:

- Confirm Signup after email/password registration. The application supplies `https://ongoleproperty.com/auth/callback` as the confirmation redirect.
- Reset Password after a forgot-password request. The application supplies `https://ongoleproperty.com/reset-password` as the recovery redirect. Supabase returns a PKCE `code`, which is exchanged exactly once by `app/auth/recovery/route.ts`.

The application does not currently initiate email-change, magic-link, or email-OTP messages. Do not configure custom templates for unused flows unless the corresponding application flow is added and tested later.

## 1. URL configuration

In Supabase Dashboard, open **Authentication → URL Configuration** and configure:

- Site URL: `https://ongoleproperty.com`
- Redirect URL: `https://ongoleproperty.com/auth/callback`
- Redirect URL: `https://ongoleproperty.com/reset-password`

Set the production application environment variable to:

```text
NEXT_PUBLIC_SITE_URL=https://ongoleproperty.com
```

The Supabase project hostname must not be substituted for the application URLs above. Keep `/auth/callback` available for signup confirmation and other supported callback flows. Keep `/reset-password` as the recovery redirect; do not point recovery email links directly at `/auth/recovery`.

## 2. Auth email templates

In Supabase Dashboard, open **Authentication → Email Templates**.

For **Confirm signup**:

1. Paste the contents of `supabase/email-templates/confirm-signup.subject.txt` into Subject.
2. Paste the contents of `supabase/email-templates/confirm-signup.html` into the message body.

For **Reset password** (Recovery):

1. Paste the contents of `supabase/email-templates/reset-password.subject.txt` into Subject.
2. Paste the contents of `supabase/email-templates/reset-password.html` into the message body.

Both templates intentionally use Supabase's `{{ .ConfirmationURL }}` variable for the CTA and fallback link. Do not replace it with a hardcoded URL, token, token hash, or code. Supabase builds the single-use confirmation/recovery URL and applies the application-provided redirect.

## 3. Custom SMTP

When production SMTP credentials are available, open **Authentication → Email / SMTP Settings**, enable **Custom SMTP**, and enter values supplied by the chosen email provider:

| Setting | Required value |
| --- | --- |
| Sender name | `OngoleProperty.com` |
| Sender email | `admin@ongoleproperty.com`, or `noreply@ongoleproperty.com` if that mailbox is configured later |
| SMTP Host | Provider-supplied hostname |
| SMTP Port | Provider-supplied port |
| SMTP Username | Provider-supplied username |
| SMTP Password | Provider-supplied password or SMTP credential |

Never commit SMTP credentials. Supabase Auth Custom SMTP credentials belong in the Supabase Dashboard, not in `NEXT_PUBLIC_*` variables and not in browser code. The repository's existing server-only `SMTP_*` variables are for separate application notifications and do not configure Supabase Auth delivery.

Send test signup and password-recovery messages after saving the provider settings. Confirm that the sender is correct, both links use the production domain after Supabase verification, signup reaches `/auth/callback`, and recovery reaches `/reset-password?code=...`.

## 4. Sender-domain DNS

Configure the records supplied by the email provider for the selected sender domain:

- SPF: authorize the provider to send for the domain.
- DKIM: publish the provider's signing record or records.
- DMARC: recommended; begin with a monitored policy appropriate for the domain's mail setup.

DNS names and values are provider-specific. Obtain them from the selected provider and verify them there before enabling production delivery. No DNS values or SMTP secrets are stored in this repository.
