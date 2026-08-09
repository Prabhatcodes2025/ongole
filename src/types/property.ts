export type TransactionType = "sale" | "rent" | "lease";
export type AreaUnit = "gadi" | "sq_ft" | "sq_yd" | "sq_m" | "acre" | "cent" | "gunta" | "hectare";

export type PropertyMedia = {
  id: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
  isCover: boolean;
};

export type PublicProperty = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  description?: string;
  transactionType: TransactionType;
  category: string;
  categorySlug: string;
  propertyType: string;
  propertyTypeSlug: string;
  price: number;
  areaValue: number;
  areaUnit: AreaUnit;
  locality: string;
  city: string;
  district: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  facing?: string;
  furnishing?: string;
  ownership?: string;
  amenities: string[];
  highlights: string[];
  tags: string[];
  videoUrl?: string;
  isVerified: boolean;
  isFeatured: boolean;
  isPinned?: boolean;
  isPremium: boolean;
  contactVisibility: "company" | "eligible_members" | "public";
  publishedAt?: string;
  media: PropertyMedia[];
  isDemo?: boolean;
};

export type PropertyFilters = {
  purpose?: TransactionType;
  category?: string;
  type?: string;
  location?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  bedrooms?: number;
  bathrooms?: number;
  facing?: string;
  furnishing?: string;
  ownership?: string;
  areaUnit?: AreaUnit;
  district?: string;
  city?: string;
  locality?: string;
  verifiedOnly?: boolean;
  featuredOnly?: boolean;
  newOnly?: boolean;
  availableOnly?: boolean;
  amenities?: string[];
  sort: "newest" | "oldest" | "price-asc" | "price-desc" | "area-asc" | "area-desc";
  page: number;
  pageSize: number;
};

export type PropertyListResult = {
  properties: PublicProperty[];
  total: number;
  page: number;
  pageSize: number;
  source: "supabase" | "demo";
  error?: string;
};
