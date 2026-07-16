export type Property = {
  id: string; slug: string; title: string; locality: string; city: string;
  price: string; area: string; purpose: "Sale" | "Rent" | "Lease";
  category: string; type: string; verified: boolean; featured?: boolean;
  highlights: string[]; color: string;
};

export const sampleProperties: Property[] = [
  { id: "PROP-2026-000101", slug: "3-bhk-apartment-for-sale-lawyer-pet-ongole", title: "Sunlit 3 BHK Apartment in Lawyer Pet", locality: "Lawyer Pet", city: "Ongole", price: "₹72 Lakhs", area: "1,680 sq.ft", purpose: "Sale", category: "Residential", type: "Apartment", verified: true, featured: true, highlights: ["East facing", "Ready to move", "Covered parking"], color: "terracotta" },
  { id: "PROP-2026-000102", slug: "residential-open-plot-for-sale-mangamuru-road-ongole", title: "Residential Open Plot near Mangamuru Road", locality: "Mangamuru Road", city: "Ongole", price: "₹38 Lakhs", area: "240 sq.yd", purpose: "Sale", category: "Residential", type: "Open Plot", verified: true, highlights: ["Clear approach road", "Residential zone", "Good frontage"], color: "sage" },
  { id: "PROP-2026-000103", slug: "commercial-office-space-for-lease-kurnool-road-ongole", title: "Premium Office Space on Kurnool Road", locality: "Kurnool Road", city: "Ongole", price: "₹55,000 / month", area: "2,200 sq.ft", purpose: "Lease", category: "Commercial", type: "Office Space", verified: true, featured: true, highlights: ["Main road", "Lift access", "Power backup"], color: "ink" },
];
