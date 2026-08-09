export const PG_CATEGORIES=["mens","womens","co_living"] as const;
export const PG_SHARING_TYPES=["single","double","triple","four_sharing"] as const;
export const PG_AMENITIES=["WiFi","AC","Laundry","Food","Power Backup","Parking","CCTV","Housekeeping","Lift","TV","Gym","Hot Water"] as const;

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
