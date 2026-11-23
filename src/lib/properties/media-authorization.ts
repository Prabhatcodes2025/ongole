export function canManagePropertyMedia(input:{
  isOwner:boolean;
  ownerEditable:boolean;
  hasPropertiesManage:boolean;
  hasPgManage:boolean;
  isPgListing:boolean;
  requestedPgContext:boolean;
}){
  if(input.hasPropertiesManage)return true;
  if(input.requestedPgContext&&input.hasPgManage&&input.isPgListing)return true;
  return input.isOwner&&input.ownerEditable;
}
