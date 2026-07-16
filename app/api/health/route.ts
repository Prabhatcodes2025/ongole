import { NextResponse } from "next/server";
import { env } from "@/src/lib/env";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.isSupabaseConfigured) return NextResponse.json({ status: "degraded", database: "not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("feature_flags").select("key", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok", database: "reachable", checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
