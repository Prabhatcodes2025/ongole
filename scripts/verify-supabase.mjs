import {createClient} from "@supabase/supabase-js";

try{process.loadEnvFile(".env.local")}catch{/* Vercel/CI supplies variables directly. */}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url||!key){console.error("Supabase verification requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");process.exit(2)}
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const failures=[];
const {data:ready,error:readyError}=await client.rpc("is_application_schema_ready");if(readyError||ready!==true)failures.push("schema probe is unavailable or not ready");
const {error:publicError}=await client.from("properties").select("id,reference_no,title,status,locality_text,area_sq_ft").eq("status","published").limit(1);if(publicError)failures.push("safe published-property read failed");
for(const [name,query] of [
  ["private property columns",client.from("properties").select("id,owner_id,latitude,longitude").limit(1)],
  ["audit logs",client.from("audit_logs").select("id").limit(1)],
  ["private media rows",client.from("property_media").select("id,storage_path").limit(1)],
  ["role mappings",client.from("user_roles").select("user_id,role_id").limit(1)],
]){const {error}=await query;if(!error)failures.push(`anonymous access unexpectedly succeeded for ${name}`)}
if(failures.length){console.error(JSON.stringify({status:"failed",failures},null,2));process.exit(1)}
console.info(JSON.stringify({status:"passed",checks:["schema_ready","public_property_read","private_property_columns_denied","audit_denied","media_denied","roles_denied"]},null,2));
