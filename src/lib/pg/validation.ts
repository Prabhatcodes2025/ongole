import {z} from "zod";
import {PG_AMENITIES,PG_CATEGORIES,PG_RENT_BASES,PG_SHARING_TYPES} from "@/src/types/pg";
import {safeGoogleMapsUrl} from "@/src/lib/google-maps";
import {youtubeVideoId} from "@/src/lib/youtube";
import {propertyContentIsProductionSafe,propertyTitleIsProductionSafe} from "@/src/lib/properties/validation";
import {facingOptions} from "@/src/config/property-catalog";

const optionalNumber=z.union([z.coerce.number().nonnegative(),z.literal("").transform(()=>undefined)]).optional();
const optionalLatitude=z.union([z.coerce.number().min(-90).max(90),z.literal("").transform(()=>undefined)]).optional();
const optionalLongitude=z.union([z.coerce.number().min(-180).max(180),z.literal("").transform(()=>undefined)]).optional();
const optionalPhone=z.string().trim().regex(/^[6-9][0-9]{9}$/).or(z.literal("")).optional();

export const pgDraftSchema=z.object({
  pg_name:z.string().trim().min(3).max(120).refine(propertyTitleIsProductionSafe,"Remove test, placeholder, code or technical content from the PG name."),
  category:z.enum(PG_CATEGORIES),
  description:z.string().trim().min(20,"Description must be at least 20 characters.").max(250,"Description must not exceed 250 characters.").refine((value)=>!/(?:\b[6-9]\d{9}\b|\b\d{3}[-\s]\d{3}[-\s]\d{4}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:^|\s)@[a-z0-9_.]+|follow\s+us|limited\s+offer|book\s+now|\b(?:fuck|shit|bitch|bastard)\b)/i.test(value),"Description cannot contain phone numbers, email addresses, WhatsApp/social handles, links, promotional advertising or profanity.").refine(propertyContentIsProductionSafe,"Description cannot contain test, code or technical content.").or(z.literal("")),
  address_line:z.string().trim().max(500).default(""),
  locality:z.string().trim().min(2).max(120).default("Ongole"),
  city:z.string().trim().min(2).max(120).default("Ongole"),
  district:z.string().trim().min(2).max(120).default("Prakasam"),
  state:z.string().trim().min(2).max(120).default("Andhra Pradesh"),
  latitude:optionalLatitude,
  longitude:optionalLongitude,
  rent_per_bed:z.coerce.number().nonnegative().default(0),
  rent_basis:z.enum(PG_RENT_BASES).default("per_bed_month"),
  google_maps_url:z.string().trim().max(1000).refine(value=>!value||Boolean(safeGoogleMapsUrl(value)),"Enter a valid Google Maps location link.").optional().default(""),
  client_draft_key:z.string().uuid().optional(),
  capacity:optionalNumber,
  food_type:z.enum(["Vegetarian","Non-Vegetarian","Mixed"]).or(z.literal("")).optional().default(""),
  lunch_box_available:z.coerce.boolean().optional().default(false),
  amenities:z.array(z.enum(PG_AMENITIES)).default([]),
  house_rules:z.array(z.string().trim().min(2).max(250)).max(30).default([]),
  video_urls:z.array(z.string().url().max(500).refine((value)=>Boolean(youtubeVideoId(value)),"Only YouTube video URLs are allowed.")).max(10).default([]),
  landmark:z.string().trim().max(160).optional().default(""),
  facing:z.string().trim().max(40).refine(value=>!value||facingOptions.includes(value),"Choose a valid facing.").optional().default(""),
  contact_name:z.string().trim().max(120).optional().default(""),
  contact_mobile:optionalPhone,
  contact_whatsapp:optionalPhone,
  contact_email:z.string().trim().email().or(z.literal("")).optional(),
  consent:z.literal("true",{error:"You must confirm authorization and communication consent."}),
}).refine(value=>(value.latitude==null)===(value.longitude==null),{message:"Choose a location so both coordinates are captured.",path:["latitude"]});

export const pgRoomSchema=z.object({
  name:z.string().trim().min(2).max(100),
  sharing_type:z.enum(PG_SHARING_TYPES),
  capacity:z.coerce.number().int().positive().max(1000),
  available_beds:z.coerce.number().int().nonnegative().max(1000),
  monthly_rent:z.coerce.number().nonnegative(),
}).refine((room)=>room.available_beds<=room.capacity,{message:"Available beds cannot exceed capacity.",path:["available_beds"]});

export function formList(value:unknown){
  if(Array.isArray(value))return value.filter((item):item is string=>typeof item==="string"&&item.trim().length>0);
  if(typeof value!=="string")return [];
  return value.split(/\r?\n|,/).map((item)=>item.trim()).filter(Boolean);
}
