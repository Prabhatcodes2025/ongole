import { createPublicSupabaseClient } from "@/src/lib/supabase/public";

export type PublicAdvertisement={id:string;title:string;slot:"hero"|"scrolling"|"flash"|"sidebar";image:string;href?:string;alt:string};

export async function getActiveAdvertisement(slot:PublicAdvertisement["slot"]):Promise<PublicAdvertisement|null>{
  const supabase=createPublicSupabaseClient();
  if(!supabase)return null;
  const now=new Date().toISOString();
  const {data,error}=await supabase.from("advertisements").select("id,title,slot,image_url,destination_url,alt_text").eq("slot",slot).eq("status","approved").or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`).order("sort_order").limit(1).maybeSingle();
  if(error||!data)return null;
  try{if(!new URL(data.image_url).hostname.endsWith(".supabase.co"))return null}catch{return null}
  return{id:data.id,title:data.title,slot:data.slot,image:data.image_url,href:data.destination_url||undefined,alt:data.alt_text};
}
