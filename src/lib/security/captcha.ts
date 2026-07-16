import { env } from "@/src/lib/env";

export async function verifyCaptcha(token: string | null, remoteIp?: string | null) {
  if (!env.captchaSecret) return !env.isProduction;
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.captchaSecret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}
