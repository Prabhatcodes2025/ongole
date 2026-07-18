import {createClient} from "@supabase/supabase-js";
import {env} from "@/src/lib/env";
export function createSupabaseServiceClient(){if(typeof window!=="undefined")throw new Error("Service-role Supabase clients are server-only.");if(!env.supabaseUrl||!env.supabaseServiceRoleKey)return null;return createClient(env.supabaseUrl,env.supabaseServiceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
