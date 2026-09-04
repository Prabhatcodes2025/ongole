import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { requestData } from "@/src/lib/request";
import { youtubeVideoId } from "@/src/lib/youtube";
import {applicablePropertyDetails,propertyDescriptionIsPublicSafe,propertyTitleIsProductionSafe} from "@/src/lib/properties/validation";

const editSchema=z.object({action:z.literal("update"),title:z.string().trim().min(10).max(120).refine(propertyTitleIsProductionSafe,"Remove test, placeholder, code or technical content from the title."),description:z.string().trim().min(40).max(10000).refine(propertyDescriptionIsPublicSafe,"Description cannot contain contact details, links, social handles, test data or technical content."),locality:z.string().trim().min(2).max(120),city:z.string().trim().min(2).max(120),district:z.string().trim().min(2).max(120),state:z.string().trim().min(2).max(120),price:z.coerce.number().nonnegative(),areaValue:z.coerce.number().positive(),areaUnit:z.enum(["gadi","sq_ft","sq_yd","sq_m","acre","cent","gunta","hectare"]),youtubeUrl:z.string().trim().max(500).optional()}).passthrough();

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();const {data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const payload=await requestData(request);const action=typeof payload.action==="string"?payload.action:"";
  const {data:property}=await supabase.from("properties").select("id,reference_no,status,title,transaction_type,details").eq("id",id).eq("owner_id",auth.user.id).is("deleted_at",null).maybeSingle();
  if(!property)return NextResponse.json({error:"Property not found."},{status:404});
  if(action==="delete"){
    const {error}=await supabase.rpc("owner_soft_delete_property",{target_property:id});if(error)return NextResponse.json({error:"This property cannot be deleted while it is under review or published."},{status:409});
    return NextResponse.redirect(new URL("/dashboard?notice=deleted",request.url),303);
  }
  if(action==="duplicate"){
    const {data,error}=await supabase.rpc("duplicate_owner_property",{target_property:id});if(error)return NextResponse.json({error:"The property could not be duplicated."},{status:409});
    return NextResponse.redirect(new URL(`/dashboard/properties/${data.id}?notice=duplicated`,request.url),303);
  }
  if(!["draft","changes_requested"].includes(property.status))return NextResponse.json({error:"This submission is locked."},{status:409});
  const parsed=editSchema.safeParse({...payload,action:"update"});if(!parsed.success)return NextResponse.json({error:"Check the property fields and try again.",fields:parsed.error.flatten().fieldErrors},{status:400});
  const value=parsed.data;const existing=property.details&&typeof property.details==="object"&&!Array.isArray(property.details)?property.details as Record<string,unknown>:{};const type=typeof existing.property_type_slug==="string"?existing.property_type_slug:"";const applicable=applicablePropertyDetails({...value,category:existing.category},property.transaction_type,type);if(!applicable.valid)return NextResponse.json({error:"Complete the fields applicable to this property type.",fields:applicable.errors},{status:400});if(value.youtubeUrl&& !youtubeVideoId(value.youtubeUrl))return NextResponse.json({error:"Enter a supported YouTube video URL."},{status:400});
  const details={...existing};for(const key of ["rent_period","property_age","floor","total_floors","bedrooms","bathrooms","facing","crop_type","soil_type","amount_basis","fencing","electricity_connection","road_access","parking","power_backup","generator","security","cctv","lift","fire_safety","waste_management","balcony","pooja_room","store_room","servant_room","gas_pipeline","google_maps_url","youtube_url","nearby_places"])delete details[key];Object.assign(details,applicable.details);
  const {error}=await supabase.from("properties").update({title:value.title,description:value.description,locality_text:value.locality,city_text:value.city,district_text:value.district,state_text:value.state,price_inr:value.price,area_value:value.areaValue,area_unit:value.areaUnit,details}).eq("id",id).eq("owner_id",auth.user.id);
  if(error)return NextResponse.json({error:"The property could not be updated."},{status:500});
  await supabase.rpc("record_audit_event",{event_action:"property.update",event_type:"property",event_reference:property.reference_no,event_old:{title:property.title},event_new:{title:value.title}});
  return NextResponse.redirect(new URL(`/dashboard/properties/${id}?notice=updated`,request.url),303);
}
