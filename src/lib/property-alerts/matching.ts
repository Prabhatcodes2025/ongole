export type AlertRequirement={
  id:string;user_id:string;transaction_type:"sale"|"rent"|"lease";
  category_slug:string|null;property_type_slug:string|null;locations:string[];
  min_budget:number|null;max_budget:number|null;min_area_sq_ft:number|null;max_area_sq_ft:number|null;
  bedrooms:number|null;active:boolean;
};

export type MatchableProperty={
  id:string;transaction_type:string;category_slug:string;property_type_slug:string;
  locality:string;city:string;district:string;price:number;area_sq_ft:number|null;
  bedrooms:number|null;status:string;
};

const normalized=(value:string)=>value.normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("en-IN");

export function matchesPropertyAlert(property:MatchableProperty,requirement:AlertRequirement){
  if(property.status!=="published"||!requirement.active)return false;
  if(property.transaction_type!==requirement.transaction_type)return false;
  if(requirement.category_slug&&property.category_slug!==requirement.category_slug)return false;
  if(requirement.property_type_slug&&property.property_type_slug!==requirement.property_type_slug)return false;
  if(requirement.locations.length){
    const locations=[property.locality,property.city,property.district].map(normalized);
    if(!requirement.locations.some(location=>locations.includes(normalized(location))))return false;
  }
  if(requirement.min_budget!==null&&property.price<requirement.min_budget)return false;
  if(requirement.max_budget!==null&&property.price>requirement.max_budget)return false;
  if(requirement.min_area_sq_ft!==null&&(property.area_sq_ft===null||property.area_sq_ft<requirement.min_area_sq_ft))return false;
  if(requirement.max_area_sq_ft!==null&&(property.area_sq_ft===null||property.area_sq_ft>requirement.max_area_sq_ft))return false;
  if(requirement.bedrooms!==null&&property.bedrooms!==requirement.bedrooms)return false;
  return true;
}

export function propertyAlertPath(slug:string,pg:boolean){
  if(!/^[a-zA-Z0-9-]+$/.test(slug))return null;
  return `${pg?"/paying-guest":"/property"}/${slug}`;
}
