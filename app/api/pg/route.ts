import {NextRequest,NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {requestData} from "@/src/lib/request";
import {formList,pgDraftSchema} from "@/src/lib/pg/validation";
import {nearbyPlacesFromInput} from "@/src/lib/properties/validation";
import {safeGoogleMapsUrl} from "@/src/lib/google-maps";
import {logEvent} from "@/src/lib/observability/logger";

export async function POST(request:NextRequest){
  const wantsJson=request.headers.get("accept")?.includes("application/json")===true;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)return wantsJson?NextResponse.json({error:"Authentication required."},{status:401}):NextResponse.redirect(new URL("/login?returnTo=/dashboard/pg/new?restore=1",request.url),303);
  if(!auth.user.email_confirmed_at)return NextResponse.json({error:"Verify your email address before creating a PG listing."},{status:403});
  const {data:permission,error:permissionError}=await supabase.rpc("check_property_posting_permission");
  if(permissionError||!(permission as {allowed?:boolean}|null)?.allowed)return NextResponse.json({error:"ONE FREE PROPERTY PER REGISTERED USER. Contact OngoleProperty.com for an additional posting permission."},{status:409});
  const raw=await requestData(request);
  const nearby=nearbyPlacesFromInput(raw);if(Object.keys(nearby.errors).length)return NextResponse.json({error:"Check the nearby places and try again.",fields:nearby.errors},{status:400});
  if(typeof raw.description!=="string"||raw.description.trim().length<20)return NextResponse.json({error:"Check the PG details and try again.",fields:{description:["Description must be at least 20 characters."]}},{status:400});
  const checked=Object.entries(raw).filter(([key,value])=>key.startsWith("amenity_")&&typeof value==="string").map(([,value])=>value as string);
  const parsed=pgDraftSchema.safeParse({...raw,amenities:[...new Set(checked)],house_rules:formList(raw.house_rules),video_urls:formList(raw.video_urls)});
  if(!parsed.success)return NextResponse.json({error:"Check the PG details and try again.",fields:parsed.error.flatten().fieldErrors},{status:400});
  if(parsed.data.client_draft_key){const{data:existing}=await supabase.from("pg_listings").select("id,property_id,properties!inner(owner_id)").contains("details",{client_draft_key:parsed.data.client_draft_key}).eq("properties.owner_id",auth.user.id).maybeSingle();if(existing){const editUrl=`/dashboard/pg/${existing.id}`;return NextResponse.json({id:existing.id,propertyId:existing.property_id,editUrl,reused:true},{status:200})}}
  const {data,error}=await supabase.rpc("create_pg_draft",{pg_payload:parsed.data});
  if(error){logEvent("error","pg.draft_create_failed",{route:"POST /api/pg",userId:auth.user.id,code:error.code,message:error.message});return NextResponse.json({error:"The PG draft could not be created. Please retry. If this continues, contact support."},{status:500})}
  const result=data as {id:string;property_id:string};
  const consent={accepted:true,accepted_at:new Date().toISOString(),accepted_by:auth.user.id,channels:["sms","whatsapp","email"]};
  const{error:detailsError}=await supabase.from("pg_listings").update({details:{landmark:parsed.data.landmark||null,facing:parsed.data.facing||null,lunch_box_available:parsed.data.lunch_box_available,nearby_places:nearby.nearby,rent_basis:parsed.data.rent_basis,google_maps_url:safeGoogleMapsUrl(parsed.data.google_maps_url),client_draft_key:parsed.data.client_draft_key||null,listing_communication_consent:consent}}).eq("id",result.id);
  if(detailsError)return NextResponse.json({error:"The PG draft was created but its additional details could not be saved."},{status:500});
  const editUrl=`/dashboard/pg/${result.id}?notice=created`;return wantsJson?NextResponse.json({id:result.id,propertyId:result.property_id,editUrl},{status:201}):NextResponse.redirect(new URL(editUrl,request.url),303);
}
