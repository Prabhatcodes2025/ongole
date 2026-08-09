import "server-only";
import {siteConfig} from "@/src/config/site";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";

type Row=Record<string,unknown>;
export type PublicPg={
  id:string;propertyId:string;reference:string;slug:string;name:string;category:string;description:string;
  address:string;landmark:string;locality:string;city:string;district:string;state:string;latitude:number|null;longitude:number|null;
  rent:number;capacity:number|null;foodType:string;amenities:string[];rules:string[];videos:string[];
  verified:boolean;featured:boolean;pinned:boolean;publishedAt:string|null;media:{id:string;url:string;alt:string}[];
  rooms:{id:string;name:string;capacity:number;availableBeds:number;rent:number}[];contactLabel:string;contactPhone:string;contactWhatsapp:string;
};
export type PgFilters={q?:string;city?:string;locality?:string;min?:number;max?:number;gender?:string;food?:string;amenities?:string[];available?:boolean;sort?:string;page:number;pageSize:number};

function nested(value:unknown){return Array.isArray(value)?(value[0] as Row|undefined):value as Row|undefined}
function strings(value:unknown){return Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[]}

async function mapRows(rows:Row[]):Promise<PublicPg[]>{
  const service=createSupabaseServiceClient();if(!service)return[];
  const propertyIds=rows.map((row)=>String(row.property_id));
  const owners=[...new Set(rows.map((row)=>String(nested(row.properties)?.owner_id||"")).filter(Boolean))],now=new Date().toISOString();
  const [{data:subscriptions},{data:profiles}]=owners.length?await Promise.all([service.from("subscriptions").select("user_id,plans!inner(price)").in("user_id",owners).eq("status","active").lte("starts_at",now).gt("ends_at",now),service.from("profiles").select("id,mobile").in("id",owners)]):[{data:[]},{data:[]}];
  const paidOwners=new Set(((subscriptions||[]) as Row[]).filter((item)=>Number(nested(item.plans)?.price||0)>0).map((item)=>String(item.user_id))),ownerPhones=new Map(((profiles||[]) as Row[]).map((item)=>[String(item.id),String(item.mobile||"")]));
  const {data:media}=propertyIds.length?await service.from("property_media").select("id,property_id,storage_path,alt_text,is_cover,sort_order").in("property_id",propertyIds).eq("processing_status","ready").eq("media_type","image").order("is_cover",{ascending:false}).order("sort_order"):{data:[]};
  const mediaRows=(media||[]) as Row[];const {data:signed}=mediaRows.length?await service.storage.from("property-media").createSignedUrls(mediaRows.map((item)=>String(item.storage_path)),3600):{data:[]};
  return rows.map((row)=>{
    const property=nested(row.properties)||{},details=nested(row.details)||{};const rooms=Array.isArray(row.pg_room_types)?row.pg_room_types as Row[]:[];const ownerId=String(property.owner_id||""),entitled=(Boolean(property.is_featured)||paidOwners.has(ownerId))&&["public","eligible_members"].includes(String(property.contact_visibility||"company"));const officialPhone=siteConfig.phone.replace(/\D/g,"").slice(-10),officialWhatsapp=siteConfig.whatsapp.replace(/\D/g,"").slice(-10),ownerPhone=String(row.contact_mobile||ownerPhones.get(ownerId)||""),ownerWhatsapp=String(row.contact_whatsapp||ownerPhone);
    return{id:String(row.id),propertyId:String(row.property_id),reference:String(property.reference_no),slug:String(property.slug),name:String(row.pg_name),category:String(row.category),description:String(property.description||""),address:String(row.address_line||""),landmark:String(details.landmark||""),locality:String(property.locality_text),city:String(property.city_text),district:String(property.district_text),state:String(property.state_text),latitude:property.latitude==null?null:Number(property.latitude),longitude:property.longitude==null?null:Number(property.longitude),rent:Number(row.rent_per_bed||0),capacity:row.capacity==null?null:Number(row.capacity),foodType:String(row.food_type||""),amenities:strings(row.amenities),rules:strings(row.house_rules),videos:strings(row.video_urls),verified:Boolean(property.is_verified),featured:Boolean(property.is_featured),pinned:Boolean(property.is_pinned),publishedAt:typeof property.published_at==="string"?property.published_at:null,rooms:rooms.map((room)=>({id:String(room.id),name:String(room.name),capacity:Number(room.capacity),availableBeds:Number(room.available_beds),rent:Number(room.monthly_rent)})),contactLabel:entitled&&ownerPhone?"Property owner":"OngoleProperty.com",contactPhone:entitled&&ownerPhone?ownerPhone:officialPhone,contactWhatsapp:entitled&&ownerWhatsapp?ownerWhatsapp:officialWhatsapp,media:mediaRows.map((item,index)=>({item,url:signed?.[index]?.signedUrl||""})).filter(({item,url})=>String(item.property_id)===String(row.property_id)&&url).slice(0,6).map(({item,url})=>({id:String(item.id),url,alt:String(item.alt_text||row.pg_name)}))};
  });
}

const SELECT="id,property_id,pg_name,category,rent_per_bed,capacity,food_type,address_line,amenities,house_rules,video_urls,contact_mobile,contact_whatsapp,details,properties!inner(reference_no,slug,description,status,owner_id,contact_visibility,locality_text,city_text,district_text,state_text,latitude,longitude,is_verified,is_featured,is_pinned,published_at,deleted_at),pg_room_types(id,name,capacity,available_beds,monthly_rent,sort_order)";

export async function listPublicPgs(filters:PgFilters){
  const service=createSupabaseServiceClient();if(!service)return{items:[],total:0};
  let roomPgIds:string[]|undefined;
  if(filters.available){
    let roomQuery=service.from("pg_room_types").select("pg_listing_id");
    if(filters.available)roomQuery=roomQuery.gt("available_beds",0);
    const {data:matchingRooms}=await roomQuery.limit(5000);
    roomPgIds=[...new Set((matchingRooms||[]).map((room)=>String(room.pg_listing_id)))];
    if(!roomPgIds.length)return{items:[],total:0};
  }
  let query=service.from("pg_listings").select(SELECT,{count:"exact"}).eq("properties.status","published").is("properties.deleted_at",null).in("category",["mens","womens","co_living"]);
  const clean=(value:string)=>value.replace(/[%(),]/g,"");
  if(filters.q)query=query.or(`pg_name.ilike.%${clean(filters.q)}%,address_line.ilike.%${clean(filters.q)}%`);
  if(filters.city)query=query.eq("properties.city_text",filters.city);
  if(filters.locality)query=query.eq("properties.locality_text",filters.locality);
  if(filters.gender)query=query.eq("category",filters.gender);
  if(filters.food)query=query.ilike("food_type",`%${clean(filters.food)}%`);
  if(filters.min!==undefined)query=query.gte("rent_per_bed",filters.min);
  if(filters.max!==undefined)query=query.lte("rent_per_bed",filters.max);
  if(filters.amenities?.length)query=query.contains("amenities",filters.amenities);
  if(roomPgIds)query=query.in("id",roomPgIds);
  const start=(filters.page-1)*filters.pageSize;
  query=query.order("is_pinned",{referencedTable:"properties",ascending:false});
  if(filters.sort==="rent_asc")query=query.order("rent_per_bed",{ascending:true});else if(filters.sort==="rent_desc")query=query.order("rent_per_bed",{ascending:false});else query=query.order("published_at",{referencedTable:"properties",ascending:false});
  const {data,count,error}=await query.range(start,start+filters.pageSize-1);
  if(error)return{items:[],total:0,error:"PG listings are temporarily unavailable."};
  return{items:await mapRows((data||[]) as unknown as Row[]),total:count||0};
}

export async function getPublicPg(slug:string){
  const service=createSupabaseServiceClient();if(!service)return null;
  const safe=slug.replace(/[^a-zA-Z0-9-]/g,"");if(!safe)return null;
  const {data}=await service.from("pg_listings").select(SELECT).eq("properties.status","published").is("properties.deleted_at",null).in("category",["mens","womens","co_living"]).eq("properties.slug",safe).maybeSingle();
  return data?(await mapRows([data as unknown as Row]))[0]||null:null;
}

export async function getSimilarPgs(pg:PublicPg,limit=3){
  const result=await listPublicPgs({city:pg.city,gender:pg.category,page:1,pageSize:limit+1});
  return result.items.filter((item)=>item.id!==pg.id).slice(0,limit);
}

export async function getPublicPgSlugs(limit=1000){
  const service=createSupabaseServiceClient();if(!service)return[];
  const {data}=await service.from("pg_listings").select("properties!inner(slug,published_at,status,deleted_at)").eq("properties.status","published").is("properties.deleted_at",null).limit(limit);
  return(data||[]).map((row)=>nested(row.properties)).filter(Boolean).map((property)=>({slug:String(property?.slug),publishedAt:property?.published_at as string|null}));
}
