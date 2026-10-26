import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch { /* CI provides environment variables. */ }

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error(JSON.stringify({status:"NOT_TESTED",reason:"missing_supabase_service_configuration"}));process.exit(2)}
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const timed=async(name,operation)=>{const started=performance.now();const result=await operation();return{name,ms:Math.round(performance.now()-started),count:result.count??(Array.isArray(result.data)?result.data.length:null),error:result.error?{code:result.error.code,message:result.error.message}:null,data:result.data}};

const [authUsers,profiles,usersPage,usersPageWithRoles,properties,pendingProperties,pgs,pendingPgs,agents,pendingAgents,enquiries]=await Promise.all([
  db.auth.admin.listUsers({page:1,perPage:1000}),
  timed("profiles_count",()=>db.from("profiles").select("id",{count:"exact",head:true})),
  timed("users_page_query",()=>db.from("profiles").select("id,reference_no,full_name,email,mobile,account_type,status,email_verified,mobile_verified,created_at",{count:"exact"}).order("created_at",{ascending:false}).range(0,24)),
  timed("users_page_query_with_roles",()=>db.from("profiles").select("id,reference_no,full_name,email,mobile,account_type,status,email_verified,mobile_verified,created_at,user_roles(roles(code,name))",{count:"exact"}).order("created_at",{ascending:false}).range(0,24)),
  timed("properties_count",()=>db.from("properties").select("id",{count:"exact",head:true})),
  timed("pending_properties",()=>db.from("properties").select("id",{count:"exact",head:true}).eq("status","pending_review")),
  timed("pg_count",()=>db.from("pg_listings").select("id",{count:"exact",head:true})),
  timed("pending_pg",()=>db.from("pg_listings").select("id,properties!inner(status)",{count:"exact",head:true}).eq("properties.status","pending_review")),
  timed("agents_count",()=>db.from("agents").select("id",{count:"exact",head:true})),
  timed("pending_agents",()=>db.from("agents").select("id",{count:"exact",head:true}).eq("status","pending")),
  timed("enquiries_count",()=>db.from("enquiries").select("id",{count:"exact",head:true})),
]);
const authIds=new Set((authUsers.data?.users||[]).map(user=>user.id));
const profileRows=await db.from("profiles").select("id");
const profileIds=new Set((profileRows.data||[]).map(profile=>profile.id));
const missingProfiles=[...authIds].filter(id=>!profileIds.has(id)).length;
const orphanProfiles=[...profileIds].filter(id=>!authIds.has(id)).length;
const checks=[profiles,usersPage,usersPageWithRoles,properties,pendingProperties,pgs,pendingPgs,agents,pendingAgents,enquiries];
console.info(JSON.stringify({
  status:checks.some(check=>check.error)||authUsers.error||profileRows.error?"FAIL":"PASS",
  authUsers:authUsers.data?.users?.length??null,missingProfiles,orphanProfiles,
  checks:checks.map(({name,ms,count,error})=>({name,ms,count,error})),
},null,2));
