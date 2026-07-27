import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {paymentPayloadHash,signatureHash,verifyRazorpayWebhookSignature} from "../src/lib/payments/razorpay";

const read=(path:string)=>readFile(new URL(path,import.meta.url),"utf8");

test("Razorpay webhook verification uses the raw payload and rejects tampering",()=>{
  const body=JSON.stringify({event:"payment.captured",payload:{payment:{entity:{id:"pay_test"}}}});
  const signature=createHmac("sha256","webhook-secret").update(body).digest("hex");
  assert.equal(verifyRazorpayWebhookSignature(body,signature,"webhook-secret"),true);
  assert.equal(verifyRazorpayWebhookSignature(`${body} `,signature,"webhook-secret"),false);
  assert.equal(verifyRazorpayWebhookSignature(body,"invalid","webhook-secret"),false);
  assert.equal(paymentPayloadHash(body).length,64);
  assert.equal(signatureHash(signature).length,64);
});

test("Sprint 5 migration enforces plans, ownership, RLS and safe trigger updates",async()=>{
  const migration=await read("../supabase/migrations/202607280001_sprint5_memberships_monetization.sql");
  for(const marker of [
    "create table public.plans","create table public.subscriptions","create table public.payment_orders",
    "create table public.payment_webhook_events","create table public.promotion_activations",
    "create table public.notifications","create table public.analytics_daily",
    "enable row level security","check_listing_plan_limit","enforce_listing_plan_limit",
    "enforce_publish_plan_limit","enforce_media_plan_limit","owner_id=auth.uid()",
    "set search_path=public,pg_temp","payload_hash","idempotency_key",
  ])assert.match(migration,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
  assert.doesNotMatch(migration,/grant\s+(insert|update|delete)[^;]*\s+to\s+anon/i);
  const updates=[...migration.matchAll(/update\s+public\.(?:properties|subscriptions|payments|promotion_activations)\b[\s\S]*?;/gi)].map((match)=>match[0]);
  assert.ok(updates.length>0);
  for(const statement of updates)assert.match(statement,/\bwhere\b/i,`Unsafe unbounded update: ${statement}`);
});

test("subscription activation and webhook processing are server-authoritative",async()=>{
  const[migration,orders,webhook,paymentButton]=await Promise.all([
    read("../supabase/migrations/202607280001_sprint5_memberships_monetization.sql"),
    read("../app/api/billing/orders/route.ts"),
    read("../app/api/payments/webhooks/razorpay/route.ts"),
    read("../src/components/billing/payment-button.tsx"),
  ]);
  assert.match(migration,/process_payment_webhook[\s\S]+on conflict\s*\(provider,provider_event_id\)/i);
  assert.match(migration,/activate_subscription[\s\S]+subscriptions\.manage/i);
  assert.match(orders,/create_payment_order|create_promotion_order/);
  assert.match(orders,/createRazorpayOrder/);
  assert.match(webhook,/verifyRazorpayWebhookSignature/);
  assert.match(webhook,/createSupabaseServiceClient/);
  assert.doesNotMatch(paymentButton,/activate_subscription|service_role/i);
});

test("promotion order function has a complete parenthesized eligibility comparison",async()=>{
  const migration=await read("../supabase/migrations/202607280001_sprint5_memberships_monetization.sql");
  const promotionOrder=migration.match(/create or replace function public\.create_promotion_order[\s\S]*?end \$\$;/i)?.[0]||"";
  assert.match(promotionOrder,/returns\s+jsonb/i);
  assert.match(promotionOrder,/language\s+plpgsql/i);
  assert.match(promotionOrder,/eligible_listing_type\s*<>\s*\(\s*case\s+when\s+is_pg\s+then\s+'pg'\s+else\s+'property'\s+end\s*\)/i);
  assert.match(promotionOrder,/raise exception 'listing_not_eligible';\s*end if;/i);
  assert.match(promotionOrder,/return\s+jsonb_build_object[\s\S]*?end \$\$;/i);
  assert.match(migration,/end \$\$;\s*create or replace function public\.claim_plan_promotion/i);
});

test("manual payments, promotions and notifications use protected workflows",async()=>{
  const[migration,manualReview,claimRoute]=await Promise.all([
    read("../supabase/migrations/202607280001_sprint5_memberships_monetization.sql"),
    read("../app/api/admin/billing/manual/[id]/route.ts"),
    read("../app/api/promotions/claim/route.ts"),
  ]);
  for(const marker of ["review_manual_payment","activate_subscription","claim_plan_promotion","expire_promotions","create_notification","exception when others then return null"])assert.match(migration,new RegExp(marker,"i"));
  assert.match(manualReview,/payments\.manage/);
  assert.match(claimRoute,/claim_plan_promotion/);
  assert.match(claimRoute,/Authentication required/);
});

test("owner analytics and admin reports enforce isolation and permission checks",async()=>{
  const[ownerEvents,ownerReport,adminAnalytics,adminReport,dashboard]=await Promise.all([
    read("../app/api/analytics/events/route.ts"),
    read("../app/api/dashboard/reports/[entity]/route.ts"),
    read("../app/admin/analytics/page.tsx"),
    read("../app/api/admin/reports/[entity]/route.ts"),
    read("../src/components/dashboard/dashboard-shell.tsx"),
  ]);
  assert.match(ownerEvents,/status","published/);
  assert.match(ownerEvents,/createSupabaseServiceClient/);
  assert.match(ownerReport,/owner_id/);
  assert.match(adminAnalytics,/analytics\.read/);
  assert.match(adminReport,/reports\.read/);
  assert.match(adminReport,/has_permission/);
  assert.match(dashboard,/permissions/);
  assert.doesNotMatch(dashboard,/SUPABASE_SERVICE_ROLE_KEY/);
});

test("notification failure isolation cannot roll back core listing operations",async()=>{
  const migration=await read("../supabase/migrations/202607280001_sprint5_memberships_monetization.sql");
  const notification=migration.match(/create or replace function public\.create_notification[\s\S]+?end \$\$;/i)?.[0]||"";
  assert.match(notification,/exception when others then return null/i);
  assert.match(migration,/properties_notification_insert/);
  assert.match(migration,/enquiry_owner_notification/);
  assert.match(migration,/subscription_activation_notification/);
});
