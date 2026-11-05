export type PropertyEditMode="owner"|"admin"|"denied";

export function resolvePropertyEditMode({isOwner,hasManagePermission,requestedAdminEdit}:{isOwner:boolean;hasManagePermission:boolean;requestedAdminEdit:boolean}):PropertyEditMode{
  if(requestedAdminEdit)return hasManagePermission?"admin":"denied";
  if(isOwner)return"owner";
  return hasManagePermission?"admin":"denied";
}
