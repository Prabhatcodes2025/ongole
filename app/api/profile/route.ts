import{NextRequest,NextResponse}from"next/server";
import{z}from"zod";
import{isValidIndianMobile,normalizeMobile}from"@/src/lib/auth/mobile";
import{requestData}from"@/src/lib/request";
import{createSupabaseServerClient}from"@/src/lib/supabase/server";
import{safeReturnPath}from"@/src/lib/auth/session";

const mobileSchema=z.string().transform(normalizeMobile).refine((value)=>value===""||isValidIndianMobile(value));
const schema=z.object({fullName:z.string().trim().min(2).max(120),mobile:mobileSchema,returnTo:z.string().optional()});

export async function POST(request:NextRequest){
  const wantsJson=request.headers.get("accept")?.includes("application/json")===true;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return wantsJson?NextResponse.json({error:"invalid_request"},{status:403}):NextResponse.redirect(new URL("/dashboard/profile?error=profile_unavailable",request.url),303);
  const raw=await requestData(request);
  const fail=(code:string,status:number)=>{
    if(wantsJson)return NextResponse.json({error:code},{status});
    const url=new URL("/dashboard/profile",request.url);url.searchParams.set("error",code);
    if(typeof raw.returnTo==="string"){url.searchParams.set("complete","1");url.searchParams.set("returnTo",safeReturnPath(raw.returnTo))}
    return NextResponse.redirect(url,303);
  };
  const parsed=schema.safeParse(raw);
  if(!parsed.success)return fail(parsed.error.issues.some(issue=>issue.path[0]==="mobile")?"invalid_mobile":"invalid_details",400);
  if(typeof raw.returnTo==="string"&&!parsed.data.mobile)return fail("invalid_mobile",400);
  const supabase=await createSupabaseServerClient();
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)return wantsJson?NextResponse.json({error:"auth_required"},{status:401}):NextResponse.redirect(new URL("/login?returnTo=%2Fdashboard%2Fprofile",request.url),303);
  const mobile=parsed.data.mobile||null;
  if(mobile){
    const{data:available,error:availabilityError}=await supabase.rpc("is_mobile_available",{candidate_mobile:mobile});
    if(availabilityError)return fail("profile_unavailable",503);
    if(!available)return fail("mobile_unavailable",409);
  }
  const{error}=await supabase.from("profiles").update({full_name:parsed.data.fullName,mobile}).eq("id",auth.user.id);
  if(error)return fail(error.code==="23505"?"mobile_unavailable":"profile_unavailable",409);
  await supabase.rpc("record_audit_event",{event_action:"profile.update",event_type:"profile",event_reference:auth.user.id,event_new:{full_name:parsed.data.fullName}});
  const redirectTo=parsed.data.returnTo?safeReturnPath(parsed.data.returnTo):"/dashboard/profile?notice=updated";
  return wantsJson?NextResponse.json({redirectTo}):NextResponse.redirect(new URL(redirectTo,request.url),303);
}
