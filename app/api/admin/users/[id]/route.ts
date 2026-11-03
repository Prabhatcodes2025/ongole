import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("status"),status:z.enum(["pending","active","suspended","blocked"]),reason:z.string().trim().min(3).max(1000)}),
  z.object({action:z.enum(["assign_role","remove_role"]),role:z.string().trim().regex(/^[a-z][a-z0-9_]{1,50}$/)}),
  z.object({action:z.literal("grant_post")}),
]);

function formResponse(request:NextRequest,id:string,type:"notice"|"error",code:string,status=303,jsonMessage=code){
  if(request.headers.get("content-type")?.includes("application/json")||request.headers.get("accept")?.includes("application/json"))return NextResponse.json(type==="error"?{error:jsonMessage}:{success:true,notice:code},{status:type==="error"?status:200});
  const url=new URL(`/admin/users/${id}`,request.url);url.searchParams.set(type,code);return NextResponse.redirect(url,303);
}

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const{id}=await params,parsed=schema.safeParse(await requestData(request));if(!parsed.success)return formResponse(request,id,"error","invalid_request",400,"Check the requested account change.");
  const supabase=await createSupabaseServerClient(),{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  if(parsed.data.action==="status"){
    const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"users.manage"});if(!allowed)return formResponse(request,id,"error","permission_denied",403,"Permission denied.");
    const{error}=await supabase.rpc("admin_set_user_status",{target_user:id,next_status:parsed.data.status,change_reason:parsed.data.reason});if(error)return formResponse(request,id,"error","status_failed",409,"The account status could not be changed.");
    return formResponse(request,id,"notice","status_updated");
  }else if(parsed.data.action==="grant_post"){
    const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"users.manage"});if(!allowed)return formResponse(request,id,"error","permission_denied",403,"Permission denied.");
    const{error}=await supabase.rpc("grant_one_property_permission",{target_user:id});if(error)return formResponse(request,id,"error","grant_failed",409,"The +1 property permission could not be granted.");
    return formResponse(request,id,"notice","post_granted");
  }else{
    const{data:allowed}=await supabase.rpc("has_permission",{required_permission:"roles.manage"});if(!allowed)return formResponse(request,id,"error","permission_denied",403,"Permission denied.");
    const fn=parsed.data.action==="assign_role"?"assign_user_role":"remove_user_role";const{error}=await supabase.rpc(fn,{target_user:id,target_role:parsed.data.role});if(error)return formResponse(request,id,"error","role_failed",409,"The role could not be changed.");await supabase.rpc("record_audit_event",{event_action:`role.${parsed.data.action}`,event_type:"user",event_reference:id,event_new:{role:parsed.data.role}});
    return formResponse(request,id,"notice",parsed.data.action==="assign_role"?"role_assigned":"role_removed");
  }
}
