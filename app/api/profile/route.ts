import{NextRequest,NextResponse}from"next/server";
import{z}from"zod";
import{isValidIndianMobile,normalizeMobile}from"@/src/lib/auth/mobile";
import{requestData}from"@/src/lib/request";
import{createSupabaseServerClient}from"@/src/lib/supabase/server";

const mobileSchema=z.string().transform(normalizeMobile).refine((value)=>value===""||isValidIndianMobile(value));
const schema=z.object({fullName:z.string().trim().min(2).max(120),mobile:mobileSchema});

export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=schema.safeParse(await requestData(request));
  if(!parsed.success)return NextResponse.json({error:"Enter a valid mobile number. Repeated-digit numbers are not accepted."},{status:400});
  const supabase=await createSupabaseServerClient();
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const mobile=parsed.data.mobile||null;
  if(mobile){
    const{data:available,error:availabilityError}=await supabase.rpc("is_mobile_available",{candidate_mobile:mobile});
    if(availabilityError)return NextResponse.json({error:"Profile validation is temporarily unavailable."},{status:503});
    if(!available)return NextResponse.json({error:"This mobile number is already registered."},{status:409});
  }
  const{error}=await supabase.from("profiles").update({full_name:parsed.data.fullName,mobile}).eq("id",auth.user.id);
  if(error)return NextResponse.json({error:error.code==="23505"?"This mobile number is already registered.":"Profile could not be updated."},{status:409});
  await supabase.rpc("record_audit_event",{event_action:"profile.update",event_type:"profile",event_reference:auth.user.id,event_new:{full_name:parsed.data.fullName}});
  return NextResponse.redirect(new URL("/dashboard/profile?notice=updated",request.url),303);
}
