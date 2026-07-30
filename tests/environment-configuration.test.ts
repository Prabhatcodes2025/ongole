import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(path, import.meta.url), "utf8");

const documentedVariables = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "NEXT_PUBLIC_FACEBOOK_URL",
  "NEXT_PUBLIC_INSTAGRAM_URL",
  "NEXT_PUBLIC_LINKEDIN_URL",
  "NEXT_PUBLIC_FEATURE_MEMBERSHIPS",
  "NEXT_PUBLIC_FEATURE_BLOG",
  "NEXT_PUBLIC_FEATURE_AGENTS",
  "NEXT_PUBLIC_FEATURE_PG",
  "NEXT_PUBLIC_CAPTCHA_SITE_KEY",
  "CAPTCHA_SECRET_KEY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM_EMAIL",
  "ADMIN_NOTIFICATION_EMAIL",
  "REDIS_URL",
  "REDIS_TOKEN",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  "SENTRY_DSN",
  "GOOGLE_SITE_VERIFICATION",
  "BING_SITE_VERIFICATION",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "AUTH_TEST_USER_EMAIL",
  "AUTH_TEST_USER_PASSWORD",
  "AUTH_TEST_ADMIN_EMAIL",
  "AUTH_TEST_ADMIN_PASSWORD",
  "PGLITE_MODULE",
] as const;

test(".env.example documents every repository-owned environment variable", async () => {
  const example = await read("../.env.example");
  const documented = new Set(
    [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
  );

  for (const variable of documentedVariables) {
    assert.ok(documented.has(variable), `${variable} is missing from .env.example`);
  }

  assert.equal(documented.size, documentedVariables.length);
  assert.doesNotMatch(example, /^NEXT_PUBLIC_SITE_NAME=/m);
  assert.doesNotMatch(example, /^CAPTCHA_PROVIDER=/m);
  assert.doesNotMatch(example, /^GOOGLE_MAPS_API_KEY=/m);
});

test("local secret files are explicitly ignored", async () => {
  const gitignore = await read("../.gitignore");
  const lines = new Set(gitignore.split(/\r?\n/).map((line) => line.trim()));
  assert.ok(lines.has(".env"));
  assert.ok(lines.has(".env.local"));
  assert.ok(lines.has("!.env.example"));
});

test("verification distinguishes strict production from local fallbacks", async () => {
  const [production, supabase] = await Promise.all([
    read("../scripts/verify-production.mjs"),
    read("../scripts/verify-supabase.mjs"),
  ]);

  assert.match(production, /VERCEL_ENV === "production"/);
  assert.match(production, /requiredInProduction: true/);
  assert.match(production, /application fallback remains active/);
  assert.match(production, /SMTP email delivery/);
  assert.match(production, /Razorpay checkout/);
  assert.match(supabase, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(supabase, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(supabase, /status: strict \? "failed" : "skipped"/);
  assert.doesNotMatch(supabase, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("Maps readiness uses the same public key as the embed", async () => {
  const [environment, propertyPage] = await Promise.all([
    read("../src/lib/env.ts"),
    read("../app/property/[slug]/page.tsx"),
  ]);
  assert.match(
    environment,
    /googleMapsKey: process\.env\.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY/,
  );
  assert.match(propertyPage, /process\.env\.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY/);
  assert.doesNotMatch(environment, /process\.env\.GOOGLE_MAPS_API_KEY/);
});
