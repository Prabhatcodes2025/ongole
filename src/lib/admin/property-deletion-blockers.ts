import type {SupabaseClient} from "@supabase/supabase-js";

export async function propertyDeletionBlockers(client:SupabaseClient,propertyId:string){
  const checks=await Promise.all([
    client.from("enquiries").select("id",{count:"exact",head:true}).eq("property_id",propertyId),
    client.from("promotion_activations").select("id",{count:"exact",head:true}).eq("property_id",propertyId),
    client.from("property_posting_uses").select("id",{count:"exact",head:true}).eq("property_id",propertyId),
    client.from("payment_orders").select("id",{count:"exact",head:true}).contains("metadata",{property_id:propertyId})
  ]);
  if(checks.some(check=>check.error))return [];
  const labels=["enquiries","promotions","posting-retention records","payments"];
  return checks.flatMap((check,index)=>(check.count||0)>0?[labels[index]]:[]);
}
