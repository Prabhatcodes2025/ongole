export const PG_CATEGORIES=["mens","womens","co_living"] as const;
export const PG_SHARING_TYPES=["single","double","triple","four_sharing"] as const;
export const PG_AMENITIES=["WiFi","AC","Laundry","Parking","CCTV","Power Backup","Food","Housekeeping","Hot Water","TV","Lift","Security","Gym"] as const;
export const PG_RENT_BASES=["per_bed_month","per_bed_day","per_room_month","per_room_day"] as const;
export type PgRentBasis=typeof PG_RENT_BASES[number];
export const PG_RENT_BASIS_LABELS:Record<PgRentBasis,string>={per_bed_month:"Per Bed / Month",per_bed_day:"Per Bed / Day",per_room_month:"Per Room / Month",per_room_day:"Per Room / Day"};
export function normalizePgRentBasis(value:unknown):PgRentBasis{const normalized=String(value||"").trim().toLowerCase().replace(/[\s/-]+/g,"_").replace(/^per_/,"per_");if(normalized==="per_bed_per_month"||normalized==="bed_month"||normalized==="monthly")return"per_bed_month";return(PG_RENT_BASES as readonly string[]).includes(normalized)?normalized as PgRentBasis:"per_bed_month"}

export type PgCategory=typeof PG_CATEGORIES[number];
export type PgSharingType=typeof PG_SHARING_TYPES[number];

export type PgRoom={
  id:string;
  name:string;
  sharing_type:PgSharingType;
  capacity:number;
  available_beds:number;
  monthly_rent:number;
  security_deposit:number|null;
  sort_order:number;
};

export type PgListing={
  id:string;
  property_id:string;
  pg_name:string;
  category:PgCategory;
  rent_per_bed:number;
  security_deposit:number|null;
  capacity:number|null;
  food_type:string|null;
  address_line:string;
  amenities:string[];
  house_rules:string[];
  video_urls:string[];
  contact_name?:string|null;
  contact_mobile?:string|null;
  contact_whatsapp?:string|null;
  contact_email?:string|null;
};
