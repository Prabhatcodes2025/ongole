import {DEV_JV_CATEGORY,facingOptions,fallbackPropertyCatalog,type PropertyCatalogData} from "@/src/config/property-catalog";
import {createPublicSupabaseClient} from "@/src/lib/supabase/public";

type Row={id:string;name:string;slug:string;category_id?:string;type?:string};

function mergeRequiredCatalog(categories:PropertyCatalogData["categories"]){
  const safe=categories.filter(category=>category.value!=="rental-lease"&&category.label.trim().toLowerCase()!=="rental & lease");
  const bySlug=new Map(safe.map(category=>[category.value,category]));
  for(const fallback of fallbackPropertyCatalog.categories){
    const current=bySlug.get(fallback.value);
    if(!current){safe.push({...fallback,types:[...fallback.types]});continue}
    const known=new Set(current.types.map(type=>type.value));
    current.types.push(...fallback.types.filter(type=>!known.has(type.value)));
  }
  return safe.sort((a,b)=>a.value===DEV_JV_CATEGORY?1:b.value===DEV_JV_CATEGORY?-1:0);
}

export async function getPublicPropertyCatalog():Promise<PropertyCatalogData>{
  const supabase=createPublicSupabaseClient();if(!supabase)return fallbackPropertyCatalog;
  const[categoriesResult,typesResult,mastersResult,locationsResult]=await Promise.all([
    supabase.from("property_categories").select("id,name,slug").eq("is_active",true).is("deleted_at",null).order("sort_order"),
    supabase.from("property_types").select("id,name,slug,category_id").eq("is_active",true).is("deleted_at",null).order("sort_order"),
    supabase.from("master_items").select("id,name,slug,kind").in("kind",["amenity","facing"]).eq("is_active",true).is("deleted_at",null).order("sort_order"),
    supabase.from("locations").select("id,name,slug,type").eq("is_active",true).is("deleted_at",null).in("type",["town","village","locality"]).order("sort_order")
  ]);
  if(categoriesResult.error||typesResult.error)return fallbackPropertyCatalog;
  const live=(categoriesResult.data as Row[]).map(category=>({value:category.slug,label:category.name,types:(typesResult.data as Row[]).filter(type=>(category.slug===DEV_JV_CATEGORY?type.slug==="open-plot":type.category_id===category.id)&&!(category.slug==="industrial"&&(type.slug==="function-hall"||type.name.trim().toLowerCase()==="function hall"))).map(type=>({value:type.slug,label:type.name}))}));
  const categories=mergeRequiredCatalog(live),masters=(mastersResult.data||[]) as unknown as Array<Row&{kind:string}>,configuredFacings=masters.filter(item=>item.kind==="facing").map(item=>item.name),configuredAmenities=masters.filter(item=>item.kind==="amenity").map(item=>item.name);
  return{categories,locations:locationsResult.data?.length?(locationsResult.data as Row[]).map(item=>item.name):fallbackPropertyCatalog.locations,facings:[...new Set([...facingOptions,...configuredFacings])],amenities:configuredAmenities.length?configuredAmenities:fallbackPropertyCatalog.amenities};
}
