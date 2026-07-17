import { transactionLabels } from "@/src/config/property-catalog";
import type { PublicProperty, TransactionType } from "@/src/types/property";

export function formatPrice(value: number, purpose?: TransactionType) {
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  return purpose === "rent" || purpose === "lease" ? `${amount} / month` : amount;
}

export function propertyPurposeLabel(property: Pick<PublicProperty, "transactionType">) {
  return transactionLabels[property.transactionType];
}
