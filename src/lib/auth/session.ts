import type {SupabaseClient,User} from "@supabase/supabase-js";

export function normalizeEmail(value:string){return value.trim().toLowerCase()}
export function safeReturnPath(value:unknown,fallback="/dashboard"){
  if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//"))return fallback;
  try{const url=new URL(value,"https://app.local");return url.origin==="https://app.local"?`${url.pathname}${url.search}${url.hash}`:fallback}catch{return fallback}
}

export async function reconcileAuthenticatedProfile(supabase:SupabaseClient,user:User){
  const {data:existing}=await supabase.from("profiles").select("id,status").eq("id",user.id).maybeSingle();
  const {data:profile,error}=await supabase.rpc("reconcile_current_profile");
  if(error||!profile)return{ok:false as const,repaired:false,status:null,errorCode:error?.code||"profile_reconciliation_failed"};
  const status=typeof profile.status==="string"?profile.status:null;
  return{ok:status==="active",repaired:!existing,status,errorCode:status==="active"?null:"account_inactive"};
}

export function loginErrorCode(error:{code?:string;message?:string}){
  const code=(error.code||"").toLowerCase(),message=(error.message||"").toLowerCase();
  if(code.includes("email_not_confirmed")||message.includes("email not confirmed"))return"email_not_confirmed";
  if(code.includes("invalid_credentials")||message.includes("invalid login credentials"))return"invalid_credentials";
  if(code.includes("over_request_rate_limit"))return"rate_limited";
  return"auth_unavailable";
}
