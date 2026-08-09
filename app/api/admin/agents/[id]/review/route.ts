import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { requestData } from "@/src/lib/request";

const schema=z.object({action:z.enum(["approve","reject"]),reason:z.string().trim().max(1000).optional()}).superRefine((value,context)=>{if(value.action==="reject"&&!value.reason)context.addIssue({code:"custom",path:["reason"],message:"A rejection reason is required."})});

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Check the review action and reason."},{status:400});
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"agents.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const{id}=await params;const{error}=await supabase.rpc("review_agent_application",{target_agent:id,review_action:parsed.data.action,review_reason:parsed.data.reason||null});
  if(error)return NextResponse.json({error:"The agent application could not be reviewed.",detail:error.message},{status:409});
  return NextResponse.redirect(new URL("/admin/agents",request.url),303);
}
