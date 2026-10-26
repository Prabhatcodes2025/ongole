export function normalizeAdminConfirmation(value:unknown){
  return typeof value==="string"?value.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase():"";
}

export function propertyConfirmation(reference:string,permanent=false){
  return normalizeAdminConfirmation(`${permanent?"DELETE ":""}${reference}`);
}
