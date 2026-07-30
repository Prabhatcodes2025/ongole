import { createClient } from "@supabase/supabase-js";
import process from "node:process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Vercel and CI provide variables directly.
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const strict =
  process.argv.includes("--required") ||
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

function configured(name) {
  const value = process.env[name]?.trim();
  return Boolean(
    value &&
      !/^(?:todo|replace(?:_me)?|change(?:_me)?|your[_-])/i.test(value),
  );
}

const missing = required.filter((name) => !configured(name));
if (missing.length) {
  const result = {
    status: strict ? "failed" : "skipped",
    reason: "supabase_not_configured",
    missing,
    message: strict
      ? "Supabase verification requires the public project URL and anon key."
      : "Local demo mode is available. Add the public Supabase URL and anon key to run live schema/RLS checks.",
  };
  console[strict ? "error" : "info"](JSON.stringify(result, null, 2));
  process.exit(strict ? 2 : 0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
try {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error();
} catch {
  console.error(
    JSON.stringify({
      status: "failed",
      reason: "invalid_supabase_url",
      message: "NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.",
    }),
  );
  process.exit(2);
}

const client = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
const failures = [];

const { data: ready, error: readyError } = await client.rpc(
  "is_application_schema_ready",
);
if (readyError || ready !== true) {
  failures.push("schema probe is unavailable or not ready");
}

const { error: publicError } = await client
  .from("properties")
  .select("id,reference_no,title,status,locality_text,area_sq_ft")
  .eq("status", "published")
  .limit(1);
if (publicError) failures.push("safe published-property read failed");

for (const [name, query] of [
  [
    "private property columns",
    client
      .from("properties")
      .select("id,owner_id,latitude,longitude")
      .limit(1),
  ],
  ["audit logs", client.from("audit_logs").select("id").limit(1)],
  [
    "private media rows",
    client.from("property_media").select("id,storage_path").limit(1),
  ],
  [
    "role mappings",
    client.from("user_roles").select("user_id,role_id").limit(1),
  ],
]) {
  const { error } = await query;
  if (!error) failures.push(`anonymous access unexpectedly succeeded for ${name}`);
}

if (failures.length) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  process.exit(1);
}

console.info(
  JSON.stringify({
    status: "passed",
    checks: [
      "schema_ready",
      "public_property_read",
      "private_property_columns_denied",
      "audit_denied",
      "media_denied",
      "roles_denied",
    ],
  }),
);
