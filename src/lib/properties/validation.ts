const prohibitedPublicContent=/(?:\b[6-9]\d{9}\b|\b\d{3}[-\s]\d{3}[-\s]\d{4}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\.|(?:^|\s)@[a-z0-9_.]+)/i;
export function propertyDescriptionIsPublicSafe(value:string){return!prohibitedPublicContent.test(value)}
export function propertyTypeSlug(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")}

const agriculturalTypes=new Set(["agricultural-land","farm-land"]);
const plotTypes=new Set(["open-plot","commercial-open-plot"]);
const residentialTypes=new Set(["independent-house","apartment-flat","villa","penthouse"]);
const commercialTypes=new Set(["shop","office","shopping-complex","commercial-building"]);
const text=(input:Record<string,unknown>,key:string)=>typeof input[key]==="string"?input[key].trim():"";
const number=(input:Record<string,unknown>,key:string)=>{if(input[key]===undefined||input[key]===null||input[key]==="")return null;const value=Number(input[key]);return Number.isFinite(value)&&value>=0?value:null};
const flag=(input:Record<string,unknown>,key:string)=>input[key]===true||input[key]==="true"||input[key]==="on";

export function applicablePropertyDetails(input:Record<string,unknown>,transactionType:string,typeValue:string){
  const type=propertyTypeSlug(typeValue),isAgricultural=agriculturalTypes.has(type),isPlot=plotTypes.has(type),isResidential=residentialTypes.has(type),isCommercial=commercialTypes.has(type),isBuilt=isResidential||isCommercial;
  const errors:Record<string,string>={};
  if(!isAgricultural&&!isPlot&&!isResidential&&!isCommercial)errors.propertyType="Choose a supported property type.";
  if(isAgricultural&&!["sale","rent"].includes(transactionType))errors.transactionType="Agricultural land supports Sale or Rent only.";
  if(isPlot&&transactionType!=="sale")errors.transactionType="Open plots support Sale only.";
  const details:Record<string,unknown>={property_type_slug:type};
  if(isBuilt){const age=text(input,"propertyAge");if(!age)errors.propertyAge="Select property age or New Property.";else details.property_age=age;details.floor=number(input,"floor");details.total_floors=number(input,"totalFloors")}
  if(isResidential){const bedrooms=number(input,"bedrooms"),bathrooms=number(input,"bathrooms"),facing=text(input,"facing");if(bedrooms===null)errors.bedrooms="Enter bedrooms.";else details.bedrooms=bedrooms;if(bathrooms===null)errors.bathrooms="Enter bathrooms.";else details.bathrooms=bathrooms;if(!facing)errors.facing="Select facing.";else details.facing=facing}
  if(isPlot){const facing=text(input,"facing");if(!facing)errors.facing="Select facing.";else details.facing=facing}
  if(isAgricultural){for(const[key,column]of [["cropType","crop_type"],["soilType","soil_type"]] as const){const value=text(input,key);if(!value)errors[key]=`Enter ${key==="cropType"?"crop":"soil"} information.`;else details[column]=value}const basis=text(input,"amountBasis");if(!basis)errors.amountBasis="Select the agricultural amount basis.";else details.amount_basis=basis}
  if(isPlot||isAgricultural){for(const[key,column]of [["fencing","fencing"],["electricityConnection","electricity_connection"],["roadAccess","road_access"]] as const){const value=text(input,key);if(!value)errors[key]=`Select ${key.replace(/([A-Z])/g," $1").toLowerCase()}.`;else details[column]=value}}
  if(isBuilt){for(const key of ["parking","powerBackup","generator","security","cctv","lift","fireSafety","wasteManagement","balcony","poojaRoom","storeRoom","servantRoom","gasPipeline"]){if(flag(input,key))details[key.replace(/[A-Z]/g,letter=>`_${letter.toLowerCase()}`)]=true}}
  const googleMapsUrl=text(input,"googleMapsUrl"),youtubeUrl=text(input,"youtubeUrl");if(googleMapsUrl){try{const host=new URL(googleMapsUrl).hostname.toLowerCase();if(host==="maps.app.goo.gl"||host==="goo.gl"||host==="google.com"||host.endsWith(".google.com"))details.google_maps_url=googleMapsUrl;else errors.googleMapsUrl="Enter a valid Google Maps link."}catch{errors.googleMapsUrl="Enter a valid Google Maps link."}}if(youtubeUrl)details.youtube_url=youtubeUrl;
  const nearby:Record<string,unknown>={};for(const[key,column]of [["nearbyCollege","college"],["nearbyHospital","hospital"],["nearbyBusDepot","bus_depot"]] as const){const value=number(input,key);if(value!==null)nearby[column]={distance:value,unit:"meters"}}
  const otherName=text(input,"nearbyOtherName"),otherDistance=number(input,"nearbyOtherDistance");if(otherName&&otherDistance!==null)nearby.other={name:otherName,distance:otherDistance,unit:"meters"};if(Object.keys(nearby).length)details.nearby_places=nearby;
  return{details,errors,valid:Object.keys(errors).length===0,type,isAgricultural,isPlot,isResidential,isCommercial};
}

export function storedPropertyDetailsValidation(details:Record<string,unknown>,transactionType:string){
  const nearby=details.nearby_places&&typeof details.nearby_places==="object"&&!Array.isArray(details.nearby_places)?details.nearby_places as Record<string,unknown>:{};
  const distance=(key:string)=>{const item=nearby[key];return item&&typeof item==="object"&&!Array.isArray(item)?(item as Record<string,unknown>).distance:undefined};
  return applicablePropertyDetails({propertyAge:details.property_age,floor:details.floor,totalFloors:details.total_floors,bedrooms:details.bedrooms,bathrooms:details.bathrooms,facing:details.facing,cropType:details.crop_type,soilType:details.soil_type,amountBasis:details.amount_basis,fencing:details.fencing,electricityConnection:details.electricity_connection,roadAccess:details.road_access,parking:details.parking,powerBackup:details.power_backup,generator:details.generator,security:details.security,cctv:details.cctv,lift:details.lift,fireSafety:details.fire_safety,wasteManagement:details.waste_management,balcony:details.balcony,poojaRoom:details.pooja_room,storeRoom:details.store_room,servantRoom:details.servant_room,gasPipeline:details.gas_pipeline,googleMapsUrl:details.google_maps_url,youtubeUrl:details.youtube_url,nearbyCollege:distance("college"),nearbyHospital:distance("hospital"),nearbyBusDepot:distance("bus_depot")},transactionType,String(details.property_type_slug||""));
}
