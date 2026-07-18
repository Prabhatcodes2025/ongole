import { createClient } from "@supabase/supabase-js";
import { env } from "@/src/lib/env";
import {logEvent} from "@/src/lib/observability/logger";

let reportedDataMode:"live"|"demo"|null=null;
function reportDataMode(mode:"live"|"demo"){
  if(reportedDataMode===mode)return;
  reportedDataMode=mode;
  logEvent(mode==="live"?"info":"warn",mode==="live"?"data_mode.live":"data_mode.demo_fallback",{supabaseConfigured:mode==="live"});
}

export function createPublicSupabaseClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {reportDataMode("demo");return null;}
  reportDataMode("live");
  return createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
