import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { checkRateLimit } from "@/src/lib/security/rate-limit";
import { requestData, requestIp } from "@/src/lib/request";
import { env } from "@/src/lib/env";

const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(200) });
const registerSchema = loginSchema.extend({ name: z.string().trim().min(2).max(100), mobile: z.string().regex(/^[6-9][0-9]{9}$/), accountType: z.enum(["buyer","owner","agent","pg_owner"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const ip = requestIp(request);
  const rate = checkRateLimit(`auth:${action}:${ip}`, action === "login" ? 6 : 3, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (!env.isSupabaseConfigured) return NextResponse.json({ error: "Authentication is not configured yet. Add the Supabase environment values." }, { status: 503 });
  const data = await requestData(request);
  const supabase = await createSupabaseServerClient();
  if (action === "login") {
    const parsed = loginSchema.safeParse(data); if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url), 303);
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }
  if (action === "register") {
    const parsed = registerSchema.safeParse(data); if (!parsed.success) return NextResponse.json({ error: "Check your registration details and try again." }, { status: 400 });
    const { email, password, name, mobile, accountType } = parsed.data;
    const { data: result, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${env.siteUrl}/dashboard`, data: { full_name: name, mobile, account_type: accountType } } });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.redirect(new URL(result.session ? "/dashboard" : "/login?notice=check_email", request.url), 303);
  }
  if (action === "logout") { await supabase.auth.signOut(); return NextResponse.redirect(new URL("/", request.url), 303); }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
