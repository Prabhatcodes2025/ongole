import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requestIp} from "@/src/lib/request";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

const schema=z.object({propertyId:z.string().uuid(),promotionType:z.enum(["featured","verified"])});

export async function POST(request:NextRequest){
  const rate=await checkRateLimit(`promotion-claim:${requestIp(request)}`,20,60*60_000);
  if(!rate.allowed)return NextResponse.json({error:"Too many promotion requests. Try again later."},{status:429});
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:"Invalid promotion request."},{status:400});
  const supabase=await createSupabaseServerClient();
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data,error}=await supabase.rpc("claim_plan_promotion",{target_property:parsed.data.propertyId,target_type:parsed.data.promotionType});
  if(error){
    const message=error.message.includes("EXHAUSTED")?"Your plan allowance for this promotion has been used.":error.message.includes("listing_not_found")?"The listing was not found or is not owned by you.":"The included promotion could not be activated.";
    return NextResponse.json({error:message},{status:409});
  }
  return NextResponse.json({activationId:data});
}
