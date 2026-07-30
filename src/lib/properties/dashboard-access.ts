export type PropertyDashboardAccess = "owner" | "admin" | "denied";

export function resolvePropertyDashboardAccess({
  authenticatedUserId,
  ownerId,
  canReadAll,
}: {
  authenticatedUserId: string | null | undefined;
  ownerId: string;
  canReadAll: boolean;
}): PropertyDashboardAccess {
  if (!authenticatedUserId) return "denied";
  if (authenticatedUserId === ownerId) return "owner";
  if (canReadAll) return "admin";
  return "denied";
}
