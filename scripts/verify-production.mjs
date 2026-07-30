import { access, readFile } from "node:fs/promises";
import process from "node:process";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI and Vercel provide variables directly.
}

const failures = [];
const warnings = [];
const checks = [];
const environmentRequested = process.argv.includes("--environment");
const strictProduction =
  process.argv.includes("--strict-production") ||
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

const read = async (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");
const requiredFile = async (path) => {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    checks.push(`file:${path}`);
  } catch {
    failures.push(`missing required file: ${path}`);
  }
};

function configured(name) {
  const value = process.env[name]?.trim();
  return Boolean(
    value &&
      !/^(?:todo|replace(?:_me)?|change(?:_me)?|your[_-])/i.test(value),
  );
}

function validateUrl(name, { httpsOnly = false } = {}) {
  if (!configured(name)) return;
  try {
    const value = new URL(process.env[name]);
    if (!["http:", "https:"].includes(value.protocol)) throw new Error();
    if (httpsOnly && value.protocol !== "https:") throw new Error();
    checks.push(`environment:${name}`);
  } catch {
    failures.push(
      `${name} must be a valid ${httpsOnly ? "HTTPS" : "HTTP(S)"} URL`,
    );
  }
}

function validateGroup(label, names, { requiredInProduction = false } = {}) {
  const present = names.filter(configured);
  if (present.length === names.length) {
    checks.push(`integration:${label}`);
    return;
  }

  const missing = names.filter((name) => !configured(name));
  if (strictProduction && requiredInProduction) {
    failures.push(
      `${label} requires production environment variables: ${missing.join(", ")}`,
    );
  } else if (present.length > 0) {
    const message = `${label} is partially configured; missing: ${missing.join(", ")}`;
    if (strictProduction) failures.push(message);
    else warnings.push(message);
  } else {
    warnings.push(`${label} is disabled; application fallback remains active`);
  }
}

const packageJson = JSON.parse(await read("package.json"));
for (const [name, expected] of Object.entries({
  build:"next build",
  start:"next start",
  lint: "eslint . --ignore-pattern .next",
  typecheck: "tsc --noEmit",
})) {
  if (packageJson.scripts?.[name] !== expected) {
    failures.push(`package script ${name} must be: ${expected}`);
  } else {
    checks.push(`script:${name}`);
  }
}

const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};
for (const name of [
  "vinext",
  "wrangler",
  "rolldown",
  "@cloudflare/next-on-pages",
  "@opennextjs/cloudflare",
]) {
  if (name in dependencies) {
    failures.push(`incompatible deployment dependency present: ${name}`);
  }
}
checks.push("deployment:standard-next");

for (const path of [
  ".env.example",
  "vercel.json",
  "app/api/cron/maintenance/route.ts",
  "supabase/migrations/202607300001_sprint6_launch_security.sql",
  "supabase/migrations/202607300002_sprint6_notification_scheduler.sql",
]) {
  await requiredFile(path);
}

const gitignore = await read(".gitignore");
for (const ignored of [".env", ".env.local"]) {
  if (
    !gitignore
      .split(/\r?\n/)
      .some((line) => line.trim() === ignored)
  ) {
    failures.push(`.gitignore must explicitly contain ${ignored}`);
  } else {
    checks.push(`gitignore:${ignored}`);
  }
}

const vercel = JSON.parse(await read("vercel.json"));
if (
  vercel.crons?.length !== 1 ||
  vercel.crons[0]?.path !== "/api/cron/maintenance"
) {
  failures.push(
    "Vercel maintenance cron is missing or points to the wrong route",
  );
} else {
  checks.push("cron:configured");
}

if (environmentRequested) {
  if (!configured("NEXT_PUBLIC_SITE_URL")) {
    failures.push("NEXT_PUBLIC_SITE_URL is required");
  } else {
    validateUrl("NEXT_PUBLIC_SITE_URL");
  }

  validateGroup(
    "Supabase browser client",
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    { requiredInProduction: true },
  );
  validateUrl("NEXT_PUBLIC_SUPABASE_URL", { httpsOnly: strictProduction });

  validateGroup(
    "maintenance scheduler",
    ["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"],
    { requiredInProduction: true },
  );
  validateGroup("Cloudflare Turnstile", [
    "NEXT_PUBLIC_CAPTCHA_SITE_KEY",
    "CAPTCHA_SECRET_KEY",
  ]);
  validateGroup("Redis REST rate limiting", ["REDIS_URL", "REDIS_TOKEN"]);
  validateUrl("REDIS_URL", { httpsOnly: true });
  validateGroup("SMTP email delivery", [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
  ]);
  validateGroup("Razorpay checkout", [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
  ]);

  const smtpPort = process.env.SMTP_PORT?.trim();
  if (
    smtpPort &&
    (!Number.isInteger(Number(smtpPort)) ||
      Number(smtpPort) < 1 ||
      Number(smtpPort) > 65535)
  ) {
    failures.push("SMTP_PORT must be an integer between 1 and 65535");
  } else if (smtpPort) {
    checks.push("environment:SMTP_PORT");
  }

  for (const optionalUrl of [
    "NEXT_PUBLIC_FACEBOOK_URL",
    "NEXT_PUBLIC_INSTAGRAM_URL",
    "NEXT_PUBLIC_LINKEDIN_URL",
  ]) {
    validateUrl(optionalUrl, { httpsOnly: strictProduction });
  }

  for (const secret of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
    "CAPTCHA_SECRET_KEY",
    "SMTP_PASSWORD",
    "REDIS_TOKEN",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "SENTRY_DSN",
  ]) {
    if (secret.startsWith("NEXT_PUBLIC_")) {
      failures.push(`server secret must not be public: ${secret}`);
    }
  }

  checks.push(
    strictProduction
      ? "environment-mode:strict-production"
      : "environment-mode:local-fallback-aware",
  );
}

if (failures.length) {
  console.error(
    JSON.stringify({ status: "failed", failures, warnings, checks }, null, 2),
  );
  process.exit(1);
}

console.info(
  JSON.stringify({ status: "passed", warnings, checks }, null, 2),
);
