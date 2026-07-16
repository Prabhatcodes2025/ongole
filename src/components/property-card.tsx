import Link from "next/link";
import type { Property } from "@/src/data/properties";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="property-card">
      <Link href={`/property/${property.slug}`} className={`property-visual ${property.color}`} aria-label={`View ${property.title}`}>
        <span className="visual-sun" /><span className="visual-building" /><span className="visual-ground" />
        <div className="badge-row">{property.verified && <span className="badge">Verified</span>}{property.featured && <span className="badge badge-warm">Featured</span>}</div>
      </Link>
      <div className="property-content">
        <p className="property-meta">{property.type} · {property.purpose}</p>
        <h3><Link href={`/property/${property.slug}`}>{property.title}</Link></h3>
        <p className="location">{property.locality}, {property.city}</p>
        <div className="price-row"><strong>{property.price}</strong><span>{property.area}</span></div>
        <ul>{property.highlights.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </article>
  );
}
