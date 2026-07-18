import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {env} from "@/src/lib/env";
import {logEvent} from "@/src/lib/observability/logger";

const webUrl=z.url().refine((value)=>/^https?:\/\//i.test(value));
const scheduleValue=z.string().refine((value)=>!value||Number.isFinite(Date.parse(value)));
const schema=z.object({action:z.enum(["create","update","approve","archive","delete"]),id:z.string().uuid().optional(),title:z.string().trim().min(3).max(120).optional(),slot:z.enum(["hero","scrolling","flash","sidebar"]).optional(),imageUrl:z.url().refine((value)=>value.startsWith("https://")).optional(),destinationUrl:z.union([webUrl,z.literal("")]).optional(),altText:z.string().trim().min(3).max(200).optional(),status:z.enum(["draft","pending","approved","rejected","archived"]).optional(),startsAt:scheduleValue.optional(),endsAt:scheduleValue.optional(),sortOrder:z.coerce.number().int().min(0).max(100000).optional()});
const timestamp=(value:string|undefined)=>value?new Date(value).toISOString():null;

export async function POST(request:NextRequest){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid origin."},{status:403});
  const parsed=schema.safeParse(await requestData(request));if(!parsed.success)return NextResponse.json({error:"Check the campaign fields."},{status:400});
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});const {data:allowed}=await supabase.rpc("has_permission",{required_permission:"settings.manage"});if(!allowed)return NextResponse.json({error:"Permission denied."},{status:403});
  const value=parsed.data;let error;let reference=value.id||value.title||"new";
  if(value.action==="create"||value.action==="update"){
    if(!value.title||!value.slot||!value.imageUrl||!value.altText)return NextResponse.json({error:"Title, slot, image and alternative text are required."},{status:400});
    if(!env.supabaseUrl||new URL(value.imageUrl).host!==new URL(env.supabaseUrl).host)return NextResponse.json({error:"Campaign images must be hosted in the configured Supabase project."},{status:400});
    const startsAt=timestamp(value.startsAt),endsAt=timestamp(value.endsAt);if(startsAt&&endsAt&&endsAt<=startsAt)return NextResponse.json({error:"The end time must be after the start time."},{status:400});
    const record={title:value.title,slot:value.slot,image_url:value.imageUrl,destination_url:value.destinationUrl||null,alt_text:value.altText,status:value.action==="create"?"draft":value.status||"draft",starts_at:startsAt,ends_at:endsAt,sort_order:value.sortOrder||0,approved_by:value.status==="approved"?auth.user.id:null};
    if(value.action==="create"){const result=await supabase.from("advertisements").insert({...record,created_by:auth.user.id}).select("id").single();error=result.error;reference=result.data?.id||reference}else{if(!value.id)return NextResponse.json({error:"Campaign ID is required."},{status:400});({error}=await supabase.from("advertisements").update(record).eq("id",value.id));}
  }else{
    if(!value.id)return NextResponse.json({error:"Campaign ID is required."},{status:400});
    if(value.action==="delete")({error}=await supabase.from("advertisements").delete().eq("id",value.id));else({error}=await supabase.from("advertisements").update({status:value.action==="approve"?"approved":"archived",approved_by:value.action==="approve"?auth.user.id:null}).eq("id",value.id));
  }
  if(error){logEvent("error","admin.advertisement_save_failed",{code:error.code,action:value.action});return NextResponse.json({error:"The campaign could not be saved. Retry or contact support with the request ID."},{status:409})}await supabase.rpc("record_audit_event",{event_action:`advertisement.${value.action}`,event_type:"advertisement",event_reference:reference,event_new:{slot:value.slot,status:value.action}});return NextResponse.redirect(new URL("/admin/advertisements",request.url),303);
}
