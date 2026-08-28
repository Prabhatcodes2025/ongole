import type { TransactionType } from "@/src/types/property";

export const propertyCategories = [
  { value: "residential", label: "Residential", types: ["independent-house", "apartment-flat", "villa", "open-plot"] },
  { value: "commercial", label: "Commercial", types: ["shop", "office", "shopping-complex", "commercial-open-plot"] },
  { value: "agricultural", label: "Agricultural", types: ["agricultural-land", "farm-land"] },
] as const;

export const propertyTypeLabels: Record<string, string> = {
  "independent-house": "Independent House",
  "apartment-flat": "Apartment / Flat",
  villa: "Villa",
  "open-plot": "Open Plot",
  shop: "Shop",
  office: "Office",
  "shopping-complex": "Shopping Complex",
  "commercial-open-plot": "Commercial Open Plot",
  "agricultural-land": "Agricultural Land",
  "farm-land": "Farm Land",
};

export const fallbackLocations = ["Ongole", "Bhagya Nagar", "Bhagyanagar", "Gopal Nagar", "Pernamitta", "Lawyer Pet", "Mangamuru Road", "Kurnool Road", "Pelluru", "Chimakurthy", "Kandukur", "Tangutur", "Maddipadu", "Singarayakonda"];
export const facingOptions = ["East", "West", "North", "South", "North East"];
export const furnishingOptions = ["Unfurnished", "Semi Furnished", "Fully Furnished"];
export const amenityOptions = ["Parking", "Power Backup", "Lift", "Security", "Water Supply", "Road Access"];
export const transactionLabels: Record<TransactionType, string> = { sale: "Sale", rent: "Rent/Lease", lease: "Rent/Lease" };

export type PropertyCatalogData={categories:Array<{value:string;label:string;types:Array<{value:string;label:string}>}>;locations:string[];facings:string[];amenities:string[]};
export const fallbackPropertyCatalog:PropertyCatalogData={categories:propertyCategories.map((category)=>({value:category.value,label:category.label,types:category.types.map((value)=>({value,label:propertyTypeLabels[value]}))})),locations:fallbackLocations,facings:facingOptions,amenities:amenityOptions};

export function typesFromCatalog(catalog:PropertyCatalogData,category?:string){return category?catalog.categories.find((item)=>item.value===category)?.types||[]:catalog.categories.flatMap((item)=>item.types)}

export function typesForCategory(category?: string) {
  if (!category) return Object.entries(propertyTypeLabels).map(([value, label]) => ({ value, label }));
  const match = propertyCategories.find((item) => item.value === category);
  return (match?.types || []).map((value) => ({ value, label: propertyTypeLabels[value] }));
}
