export const PERMISSIONS={
  propertiesRead:"properties.read",propertiesManage:"properties.manage",
  enquiriesRead:"enquiries.read",enquiriesManage:"enquiries.manage",
  usersRead:"users.read",usersManage:"users.manage",
  agentsRead:"agents.read",agentsManage:"agents.manage",
  settingsManage:"settings.manage",seoManage:"seo.manage",
  analyticsRead:"analytics.read",auditRead:"audit.read",rolesManage:"roles.manage",
  pgRead:"pg.read",pgManage:"pg.manage",
  plansRead:"plans.read",plansManage:"plans.manage",
  subscriptionsRead:"subscriptions.read",subscriptionsManage:"subscriptions.manage",
  paymentsRead:"payments.read",paymentsManage:"payments.manage",refundsManage:"refunds.manage",
  promotionsRead:"promotions.read",promotionsManage:"promotions.manage",
  reportsRead:"reports.read",notificationsManage:"notifications.manage",
} as const;
export type PermissionCode=typeof PERMISSIONS[keyof typeof PERMISSIONS];

export function hasPermission(context:unknown,permission:PermissionCode){
  if(!context||typeof context!=="object")return false;
  const permissions=(context as {permissions?:unknown}).permissions;
  return Array.isArray(permissions)&&permissions.includes(permission);
}
