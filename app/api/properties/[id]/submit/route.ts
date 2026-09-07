import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData,requestIp} from "@/src/lib/request";
import {verifyCaptcha} from "@/src/lib/security/captcha";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {storedPropertyDetailsValidation} from "@/src/lib/properties/validation";

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;const wantsJson=request.headers.get("accept")?.includes("application/json")===true;const ip=requestIp(request);
  const rate=await checkRateLimit(`property-submit:${ip}`,10,60*60_000);if(!rate.allowed)return NextResponse.json({error:"Submission limit reached."},{status:429});
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});if(!auth.user.email_confirmed_at)return NextResponse.json({error:"Verify your email address before submitting a property."},{status:403});
  const payload=await requestData(request);const token=typeof payload["cf-turnstile-response"]==="string"?payload["cf-turnstile-response"]:null;if(!await verifyCaptcha(token,ip))return NextResponse.json({error:"CAPTCHA verification failed."},{status:400});
  const{data:property}=await supabase.from("properties").select("transaction_type,details").eq("id",id).eq("owner_id",auth.user.id).maybeSingle();if(!property)return NextResponse.json({error:"Property not found."},{status:404});
  const details=property.details&&typeof property.details==="object"&&!Array.isArray(property.details)?property.details as Record<string,unknown>:{};const validation=storedPropertyDetailsValidation(details,property.transaction_type);if(!validation.valid)return NextResponse.json({error:"Complete all fields applicable to this property type before submitting.",fields:validation.errors},{status:409});
  const{error}=await supabase.rpc("submit_property_for_review",{target_property:id});if(error)return NextResponse.json({error:error.message==="PROPERTY_POSTING_LIMIT_REACHED"?"ONE FREE PROPERTY PER REGISTERED USER. Contact OngoleProperty.com for an additional posting permission.":"The property is incomplete or cannot be submitted from its current status."},{status:409});
  await supabase.rpc("record_audit_event",{event_action:"property.submit",event_type:"property",event_reference:id,event_new:{status:"pending_review"}});
  return wantsJson?NextResponse.json({id,status:"pending_review"}):NextResponse.redirect(new URL(`/dashboard/properties/${id}?notice=submitted`,request.url),303);
}
