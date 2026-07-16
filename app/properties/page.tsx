import type { Metadata } from "next";
import Link from "next/link";
import { PropertyCard } from "@/src/components/property-card";
import { PropertySearch } from "@/src/components/property-search";
import { sampleProperties } from "@/src/data/properties";

export const metadata: Metadata = { title: "Properties in Ongole", description: "Search verified residential, commercial, agricultural, rental and investment properties across Ongole and Prakasam District.", alternates: { canonical: "/properties" } };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const purpose = typeof query.purpose === "string" ? query.purpose.toLowerCase() : "";
  const category = typeof query.category === "string" ? query.category.toLowerCase() : "";
  const location = typeof query.location === "string" ? query.location.toLowerCase() : "";
  const properties = sampleProperties.filter((item) => (!purpose || item.purpose.toLowerCase() === purpose) && (!category || item.category.toLowerCase() === category) && (!location || `${item.title} ${item.locality} ${item.city} ${item.id}`.toLowerCase().includes(location)));
  return <main id="main"><section className="inner-hero"><div className="shell"><p className="eyebrow">Verified property discovery</p><h1>Properties in Ongole &amp; Prakasam</h1><p>Search practical, professionally reviewed opportunities across residential, commercial, agricultural and rental categories.</p><PropertySearch /></div></section><section className="section shell"><div className="results-bar"><div><strong>{properties.length}</strong> matching properties</div><label>Sort by <select defaultValue="recent"><option value="recent">Recently listed</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>{properties.length ? <div className="property-grid">{properties.map((property) => <PropertyCard key={property.id} property={property} />)}</div> : <div className="empty-state"><h2>No exact matches yet</h2><p>Try a broader location or budget, or tell our team what you need.</p><Link className="button" href="/contact">Send a requirement</Link></div>}</section></main>;
}
