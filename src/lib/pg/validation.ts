import {z} from "zod";
import {PG_AMENITIES,PG_CATEGORIES,PG_SHARING_TYPES} from "@/src/types/pg";
import {youtubeVideoId} from "@/src/lib/youtube";

const optionalNumber=z.union([z.coerce.number().nonnegative(),z.literal("").transform(()=>undefined)]).optional();
const optionalCoordinate=z.union([z.coerce.number(),z.literal("").transform(()=>undefined)]).optional();
const optionalPhone=z.string().trim().regex(/^[6-9][0-9]{9}$/).or(z.literal("")).optional();

export const pgDraftSchema=z.object({
  pg_name:z.string().trim().min(3).max(120),
  category:z.enum(PG_CATEGORIES),
  description:z.string().trim().refine((value)=>value.split(/\s+/).filter(Boolean).length<=250,"Description must not exceed 250 words.").refine((value)=>!/(?:\b[6-9]\d{9}\b|\b\d{3}[-\s]\d{3}[-\s]\d{4}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:^|\s)@[a-z0-9_.]+|follow\s+us|limited\s+offer|book\s+now|\b(?:fuck|shit|bitch|bastard)\b)/i.test(value),"Description cannot contain contact details, links, social handles, promotional advertising or profanity.").max(3000).default(""),
  address_line:z.string().trim().max(500).default(""),
  locality:z.string().trim().min(2).max(120).default("Ongole"),
  city:z.string().trim().min(2).max(120).default("Ongole"),
  district:z.string().trim().min(2).max(120).default("Prakasam"),
  state:z.string().trim().min(2).max(120).default("Andhra Pradesh"),
  latitude:optionalCoordinate,
  longitude:optionalCoordinate,
  rent_per_bed:z.coerce.number().nonnegative().default(0),
  capacity:optionalNumber,
  food_type:z.string().trim().max(80).optional().default(""),
  amenities:z.array(z.enum(PG_AMENITIES)).default([]),
  house_rules:z.array(z.string().trim().min(2).max(250)).max(30).default([]),
  video_urls:z.array(z.string().url().max(500).refine((value)=>Boolean(youtubeVideoId(value)),"Only YouTube video URLs are allowed.")).max(10).default([]),
  landmark:z.string().trim().max(160).optional().default(""),
  contact_name:z.string().trim().max(120).optional().default(""),
  contact_mobile:optionalPhone,
  contact_whatsapp:optionalPhone,
  contact_email:z.string().trim().email().or(z.literal("")).optional(),
});

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
