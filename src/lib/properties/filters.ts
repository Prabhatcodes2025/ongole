import type { PropertyFilters, TransactionType } from "@/src/types/property";

type SearchParams = Record<string, string | string[] | undefined>;

function text(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value: string) {
  if (value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function parsePropertyFilters(params: SearchParams): PropertyFilters {
  const purpose = text(params, "purpose");
  const sort = text(params, "sort");
  const amenities = params.amenities;
  return {
    purpose: (["sale", "rent", "lease"] as string[]).includes(purpose) ? purpose as TransactionType : undefined,
    category: text(params, "category") || undefined,
    type: text(params, "type") || undefined,
    location: text(params, "location") || undefined,
    keyword: text(params, "q") || undefined,
    minPrice: positiveNumber(text(params, "minPrice")),
    maxPrice: positiveNumber(text(params, "maxPrice")),
    minArea: positiveNumber(text(params, "minArea")),
    maxArea: positiveNumber(text(params, "maxArea")),
    bedrooms: positiveNumber(text(params, "bedrooms")),
    bathrooms: positiveNumber(text(params, "bathrooms")),
    facing: text(params, "facing") || undefined,
    furnishing: text(params, "furnishing") || undefined,
    amenities: (Array.isArray(amenities) ? amenities : amenities ? [amenities] : []).filter(Boolean),
    sort: (["newest", "oldest", "price-asc", "price-desc", "area-asc", "area-desc"] as string[]).includes(sort) ? sort as PropertyFilters["sort"] : "newest",
    page: Math.max(1, Math.floor(positiveNumber(text(params, "page")) || 1)),
    pageSize: 9,
  };
}

export function activeFilterEntries(filters: PropertyFilters) {
  return Object.entries(filters).filter(([key, value]) => !["sort", "page", "pageSize"].includes(key) && value !== undefined && value !== "" && (!Array.isArray(value) || value.length));
}
