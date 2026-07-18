import { demoProperties } from "@/src/data/demo-properties";
import { convertArea } from "@/src/lib/area-conversion";
import { createPublicSupabaseClient } from "@/src/lib/supabase/public";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
import type { AreaUnit, PropertyFilters, PropertyListResult, PropertyMedia, PublicProperty } from "@/src/types/property";

const SELECT = "id,reference_no,slug,title,description,transaction_type,price_inr,area_value,area_unit,locality_text,city_text,district_text,state_text,details,is_verified,is_featured,is_pinned,is_premium,contact_visibility,published_at,property_categories(name,slug),property_types(name,slug)";

type Row = Record<string, unknown>;

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []; }

async function hydrateMedia(rows: Row[]) {
  const service = createSupabaseServiceClient();
  const result=new Map<string,PropertyMedia[]>();
  if (!service||!rows.length) return result;
  const ids=rows.map((row)=>String(row.id));
  const { data: mediaRows } = await service.from("property_media").select("id,property_id,storage_path,alt_text,width,height,is_cover,sort_order,processing_status,media_type").in("property_id",ids).eq("processing_status", "ready").eq("media_type", "image").order("is_cover", { ascending:false }).order("sort_order", { ascending:true });
  const grouped=new Map<string,Row[]>();
  for(const item of (mediaRows||[]) as Row[]){const id=String(item.property_id);const group=grouped.get(id)||[];if(group.length<6){group.push(item);grouped.set(id,group)}}
  const ready=[...grouped.values()].flat();if(!ready.length)return result;
  const paths=ready.map((item)=>String(item.storage_path));
  const { data } = await service.storage.from("property-media").createSignedUrls(paths, 60 * 60);
  ready.forEach((item,index)=>{const url=data?.[index]?.signedUrl;if(!url)return;const id=String(item.property_id);const row=rows.find((candidate)=>String(candidate.id)===id);const group=result.get(id)||[];group.push({id:String(item.id),url,alt:String(item.alt_text||row?.title||"Property image"),width:Number(item.width)||undefined,height:Number(item.height)||undefined,isCover:Boolean(item.is_cover)});result.set(id,group)});return result;
}

function mapRow(row: Row, media:PropertyMedia[]=[]): PublicProperty {
  const details = object(row.details);
  const category = Array.isArray(row.property_categories) ? object(row.property_categories[0]) : object(row.property_categories);
  const propertyType = Array.isArray(row.property_types) ? object(row.property_types[0]) : object(row.property_types);
  return {
    id: String(row.id), reference: String(row.reference_no), slug: String(row.slug), title: String(row.title), description: String(row.description || ""),
    transactionType: String(row.transaction_type) as PublicProperty["transactionType"], category: String(category.name || details.category_label || details.category || "Property"), categorySlug: String(category.slug || details.category || "property"), propertyType: String(propertyType.name || details.property_type || "Property"), propertyTypeSlug: String(propertyType.slug || details.property_type_slug || "property"),
    price: Number(row.price_inr || 0), areaValue: Number(row.area_value || 0), areaUnit: String(row.area_unit || "sq_ft") as AreaUnit,
    locality: String(row.locality_text), city: String(row.city_text), district: String(row.district_text), state: String(row.state_text),
    bedrooms: Number(details.bedrooms) || undefined, bathrooms: Number(details.bathrooms) || undefined, facing: typeof details.facing === "string" ? details.facing : undefined, furnishing: typeof details.furnishing === "string" ? details.furnishing : undefined,
    amenities: strings(details.amenities), highlights: strings(details.highlights), tags: strings(details.tags), videoUrl: typeof details.youtube_url === "string" ? details.youtube_url : undefined,
    isVerified: Boolean(row.is_verified), isFeatured: Boolean(row.is_featured), isPinned: Boolean(row.is_pinned), isPremium: Boolean(row.is_premium), contactVisibility: String(row.contact_visibility || "company") as PublicProperty["contactVisibility"], publishedAt: typeof row.published_at === "string" ? row.published_at : undefined,
    media,
  };
}

async function mapRows(rows:Row[]){const media=await hydrateMedia(rows);return rows.map((row)=>mapRow(row,media.get(String(row.id))||[]))}

function filterDemo(properties: PublicProperty[], filters: PropertyFilters) {
  const keyword = filters.keyword?.toLowerCase(); const location = filters.location?.toLowerCase();
  return properties.filter((item) => (!filters.purpose || item.transactionType === filters.purpose) && (!filters.category || item.categorySlug === filters.category) && (!filters.type || item.propertyTypeSlug === filters.type) && (!location || `${item.locality} ${item.city} ${item.district}`.toLowerCase().includes(location)) && (!keyword || `${item.title} ${item.reference} ${item.description || ""}`.toLowerCase().includes(keyword)) && (filters.minPrice === undefined || item.price >= filters.minPrice) && (filters.maxPrice === undefined || item.price <= filters.maxPrice) && (filters.minArea === undefined || convertArea(item.areaValue, item.areaUnit, "sq_ft") >= filters.minArea) && (filters.maxArea === undefined || convertArea(item.areaValue, item.areaUnit, "sq_ft") <= filters.maxArea) && (filters.bedrooms === undefined || item.bedrooms === filters.bedrooms) && (filters.bathrooms === undefined || item.bathrooms === filters.bathrooms) && (!filters.facing || item.facing?.toLowerCase() === filters.facing.toLowerCase()) && (!filters.furnishing || item.furnishing?.toLowerCase() === filters.furnishing.toLowerCase()) && (!filters.amenities?.length || filters.amenities.every((amenity) => item.amenities.includes(amenity))));
}

export function sortProperties(properties: PublicProperty[], sort: PropertyFilters["sort"]) {
  return [...properties].sort((a, b) => sort === "oldest" ? Date.parse(a.publishedAt || "") - Date.parse(b.publishedAt || "") : sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "area-asc" ? convertArea(a.areaValue, a.areaUnit, "sq_ft") - convertArea(b.areaValue, b.areaUnit, "sq_ft") : sort === "area-desc" ? convertArea(b.areaValue, b.areaUnit, "sq_ft") - convertArea(a.areaValue, a.areaUnit, "sq_ft") : Date.parse(b.publishedAt || "") - Date.parse(a.publishedAt || ""));
}

export async function listPublicProperties(filters: PropertyFilters): Promise<PropertyListResult> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) { const filtered = sortProperties(filterDemo(demoProperties, filters), filters.sort); const start = (filters.page - 1) * filters.pageSize; return { properties: filtered.slice(start, start + filters.pageSize), total: filtered.length, page: filters.page, pageSize: filters.pageSize, source: "demo" }; }
  let query = supabase.from("properties").select(SELECT, { count: "exact" }).eq("status", "published").is("deleted_at", null);
  if (filters.purpose) query = query.eq("transaction_type", filters.purpose);
  if (filters.category) query = query.contains("details", { category: filters.category });
  if (filters.type) query = query.contains("details", { property_type_slug: filters.type });
  if (filters.location) query = query.or(`locality_text.ilike.%${filters.location.replace(/[%(),]/g, "")}%,city_text.ilike.%${filters.location.replace(/[%(),]/g, "")}%`);
  if (filters.keyword) query = query.or(`title.ilike.%${filters.keyword.replace(/[%(),]/g, "")}%,reference_no.ilike.%${filters.keyword.replace(/[%(),]/g, "")}%`);
  if (filters.minPrice !== undefined) query = query.gte("price_inr", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price_inr", filters.maxPrice);
  if (filters.minArea !== undefined) query = query.gte("area_sq_ft", filters.minArea);
  if (filters.maxArea !== undefined) query = query.lte("area_sq_ft", filters.maxArea);
  if (filters.bedrooms !== undefined) query = query.contains("details", { bedrooms: filters.bedrooms });
  if (filters.bathrooms !== undefined) query = query.contains("details", { bathrooms: filters.bathrooms });
  if (filters.facing) query = query.contains("details", { facing: filters.facing });
  if (filters.furnishing) query = query.contains("details", { furnishing: filters.furnishing });
  if (filters.amenities?.length) query = query.contains("details", { amenities: filters.amenities });
  const sortMap: Record<PropertyFilters["sort"], [string, boolean]> = { newest:["published_at",false], oldest:["published_at",true], "price-asc":["price_inr",true], "price-desc":["price_inr",false], "area-asc":["area_sq_ft",true], "area-desc":["area_sq_ft",false] };
  const [column, ascending] = sortMap[filters.sort]; const start = (filters.page - 1) * filters.pageSize;
  const { data, count, error } = await query.order("is_pinned", { ascending:false }).order(column, { ascending, nullsFirst: false }).range(start, start + filters.pageSize - 1);
  if (error) return { properties: [], total: 0, page: filters.page, pageSize: filters.pageSize, source: "supabase", error: "Properties are temporarily unavailable." };
  return { properties: await mapRows((data || []) as Row[]), total: count || 0, page: filters.page, pageSize: filters.pageSize, source: "supabase" };
}

export async function getFeaturedProperties(limit = 6) { return (await listPublicProperties({ sort:"newest", page:1, pageSize:limit })).properties.slice(0, limit); }

export async function getPublicProperty(slug: string) {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return demoProperties.find((item) => item.slug === slug || item.reference.toLowerCase() === slug.toLowerCase()) || null;
  const safeSlug=slug.replace(/[^a-zA-Z0-9-]/g,"");
  if(!safeSlug)return null;
  const { data } = await supabase.from("properties").select(SELECT).eq("status", "published").is("deleted_at", null).or(`slug.eq.${safeSlug},reference_no.eq.${safeSlug}`).maybeSingle();
  return data ? (await mapRows([data as Row]))[0] : null;
}

export async function getSimilarProperties(property: PublicProperty, limit = 3) {
  const result = await listPublicProperties({ purpose: property.transactionType, category: property.categorySlug, location: property.city, sort:"newest", page:1, pageSize:limit + 1 });
  return result.properties.filter((item) => item.id !== property.id).slice(0, limit);
}

export async function getPublicPropertyContact(property: PublicProperty) {
  if (property.isDemo) return null;
  const supabase=createPublicSupabaseClient(); if(!supabase)return null;
  const {data}=await supabase.rpc("get_property_contact",{target_property:property.id});
  const contact=Array.isArray(data)?data[0]:null;
  return contact&&typeof contact.phone==="string"?{label:String(contact.label),phone:contact.phone}:null;
}

export async function getPublicPropertyMap(property: PublicProperty) {
  if (property.isDemo||!property.isPremium)return null;
  const supabase=createPublicSupabaseClient();if(!supabase)return null;
  const {data}=await supabase.rpc("get_public_property_map",{target_property:property.id});
  const point=Array.isArray(data)?data[0]:null;
  return point&&point.latitude!=null&&point.longitude!=null?{latitude:Number(point.latitude),longitude:Number(point.longitude)}:null;
}

export async function getPublicPropertySlugs(limit = 1000) {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.from("properties").select("slug,published_at").eq("status", "published").is("deleted_at", null).not("slug", "is", null).order("published_at", { ascending:false }).limit(limit);
  return (data || []).map((row) => ({ slug: row.slug as string, publishedAt: row.published_at as string | null }));
}
