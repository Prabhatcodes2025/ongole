import {z} from "zod";
import type {PropertyCatalogData} from "@/src/config/property-catalog";

export const requirementSchema=z.object({
  transaction_type:z.enum(["sale","rent","lease"]),
  category_slug:z.string().max(80).nullable(),property_type_slug:z.string().max(80).nullable(),
  locations:z.array(z.string().trim().min(1).max(120)).max(5),
  min_budget:z.number().finite().min(0).max(1e14).nullable(),max_budget:z.number().finite().min(0).max(1e14).nullable(),
  min_area_sq_ft:z.number().finite().min(0).max(1e12).nullable(),max_area_sq_ft:z.number().finite().min(0).max(1e12).nullable(),
  bedrooms:z.number().int().min(0).max(20).nullable(),
}).refine(v=>v.min_budget===null||v.max_budget===null||v.min_budget<=v.max_budget,{message:"Minimum budget must not exceed maximum budget."})
  .refine(v=>v.min_area_sq_ft===null||v.max_area_sq_ft===null||v.min_area_sq_ft<=v.max_area_sq_ft,{message:"Minimum area must not exceed maximum area."});

export function requirementUsesCatalog(value:z.infer<typeof requirementSchema>,catalog:PropertyCatalogData){
  if(value.category_slug){const category=catalog.categories.find(item=>item.value===value.category_slug);if(!category)return false;if(value.property_type_slug&&!category.types.some(item=>item.value===value.property_type_slug))return false;}
  else if(value.property_type_slug&&!catalog.categories.some(item=>item.types.some(type=>type.value===value.property_type_slug)))return false;
  const locations=new Set(catalog.locations.map(item=>item.toLocaleLowerCase("en-IN")));
  return value.locations.every(item=>locations.has(item.toLocaleLowerCase("en-IN")));
}

export function optionalNumber(value:unknown){if(value===null||value===undefined||value==="")return null;const number=Number(value);return Number.isFinite(number)?number:NaN;}
