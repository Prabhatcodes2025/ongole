import { transactionLabels } from "@/src/config/property-catalog";
import type { PublicProperty, TransactionType } from "@/src/types/property";

export function formatPrice(value: number, purpose?: TransactionType) {
  const amount = `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
  return purpose === "rent" || purpose === "lease" ? `${amount} / ${purpose === "lease" ? "Year" : "Month"}` : amount;
}

export function formatPropertyPrice(property: Pick<PublicProperty,"price"|"transactionType"|"rentPeriod"|"amountBasis">) {
  const amount=`₹${new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(property.price)}`;
  if(property.amountBasis==="per_acre")return `Price: ${amount} / Acre`;
  if(property.amountBasis==="total_property")return `Price: ${amount} (Total Property)`;
  if(property.amountBasis==="per_acre_year")return `Rent/Lease: ${amount} / Acre / Year`;
  if(property.amountBasis==="per_acre_crop")return `Rent/Lease: ${amount} / Acre / Crop`;
  if(property.transactionType==="rent"||property.transactionType==="lease")return `Rent/Lease: ${amount} / ${property.rentPeriod==="year"||property.transactionType==="lease"?"Year":"Month"}`;
  return `Price: ${amount}`;
}

export function propertyPurposeLabel(property: Pick<PublicProperty, "transactionType">) {
  return transactionLabels[property.transactionType];
}
