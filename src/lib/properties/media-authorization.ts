export function canManagePropertyMedia(input:{
  isOwner:boolean;
  ownerEditable:boolean;
  hasPropertiesManage:boolean;
  hasPgManage:boolean;
  isPgListing:boolean;
  requestedPgContext:boolean;
}){
  if(input.isOwner)return input.ownerEditable;
  if(input.hasPropertiesManage)return true;
  return input.requestedPgContext&&input.hasPgManage&&input.isPgListing;
}
