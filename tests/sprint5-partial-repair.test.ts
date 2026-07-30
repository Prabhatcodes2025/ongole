import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607310001_sprint5_promotions_transactions_repair.sql",
  import.meta.url,
);
const verificationPath = new URL(
  "../supabase/verification/202607310001_sprint5_promotions_transactions_repair_verify.sql",
  import.meta.url,
);

const migration = await readFile(migrationPath, "utf8");
const verification = await readFile(verificationPath, "utf8");
const normalized = migration.toLowerCase();

test("Sprint 5 repair is additive and uses canonical table names", () => {
  assert.doesNotMatch(normalized, /\bdrop\s+(?:table|sequence|function|policy|trigger)\b/);
  assert.doesNotMatch(normalized, /\btruncate\b/);
  assert.doesNotMatch(normalized, /\bdelete\s+from\b/);
  assert.doesNotMatch(normalized, /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.promotions\b/);
  assert.doesNotMatch(normalized, /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.transactions\b/);

  for (const table of [
    "promotion_products",
    "promotion_activations",
    "payment_orders",
    "payment_transactions",
    "payment_webhook_events",
    "invoices",
    "refunds",
    "manual_payment_requests",
  ]) {
    assert.match(
      normalized,
      new RegExp(`create table if not exists public\\.${table}\\b`),
      `${table} must be created idempotently`,
    );
    assert.match(
      normalized,
      new RegExp(`alter table public\\.${table} enable row level security`),
      `${table} must have RLS enabled`,
    );
  }
});

test("Sprint 5 repair restores transaction and promotion functions safely", () => {
  for (const functionName of [
    "create_payment_order",
    "create_promotion_order",
    "claim_plan_promotion",
    "process_payment_webhook",
    "submit_manual_payment",
    "review_manual_payment",
    "enqueue_expiry_notifications",
    "expire_promotions",
  ]) {
    assert.match(
      normalized,
      new RegExp(`create or replace function public\\.${functionName}\\b`),
      `${functionName} must be restored`,
    );
  }

  assert.match(normalized, /set search_path=public,pg_temp/g);
  assert.match(
    normalized,
    /update public\.promotion_activations activation[\s\S]*?where activation\.id=target;/,
  );
  assert.match(
    normalized,
    /update public\.properties property[\s\S]*?where property\.id in \(/,
  );

  const expireFunction = normalized.slice(
    normalized.indexOf("create or replace function public.expire_promotions"),
    normalized.indexOf(
      "revoke all on function public.create_payment_order",
    ),
  );
  assert.match(expireFunction, /public\.promotion_activations/);
  assert.match(expireFunction, /public\.promotion_products/);
  assert.doesNotMatch(expireFunction, /public\.promotions\b/);
});

test("Sprint 5 repair preserves existing configuration and limits grants", () => {
  assert.match(normalized, /on conflict\(code\) do nothing;/);
  assert.match(normalized, /on conflict\(slug\) do nothing;/);
  assert.match(normalized, /on conflict do nothing;/);
  assert.doesNotMatch(
    normalized,
    /grant\s+(?:insert|update|delete|all)[\s\S]*?public\.promotion_products\s+to\s+anon/,
  );
  assert.match(
    normalized,
    /grant select on public\.promotion_products to anon, authenticated;/,
  );
  assert.match(
    normalized,
    /grant execute on function public\.process_payment_webhook[\s\S]*?to service_role;/,
  );
});

test("Sprint 5 repair includes read-only post-deployment verification", () => {
  const verificationNormalized = verification.toLowerCase();
  assert.match(verificationNormalized, /to_regclass/);
  assert.match(verificationNormalized, /to_regprocedure/);
  assert.match(verificationNormalized, /pg_policies/);
  assert.match(verificationNormalized, /relrowsecurity/);
  assert.match(verificationNormalized, /no_legacy_promotions_reference/);
  assert.doesNotMatch(
    verificationNormalized,
    /^\s*(?:insert|update|delete|truncate)\b/gm,
  );
});
