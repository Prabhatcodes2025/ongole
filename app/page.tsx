import Link from "next/link";
import { PropertyCard } from "@/src/components/property-card";
import { PropertySearch } from "@/src/components/property-search";
import { sampleProperties } from "@/src/data/properties";

export default function Home() {
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-sky"><span className="hero-orb" /><span className="hero-tower tower-one" /><span className="hero-tower tower-two" /><span className="hero-house" /></div>
        <div className="shell hero-content">
          <p className="eyebrow">Ongole&apos;s trusted property partner since 2002</p>
          <h1>Find the right property.<br /><em>Move with confidence.</em></h1>
          <p className="hero-copy">Verified homes, plots, commercial spaces, agricultural land and rentals—supported by local expertise and professional legal guidance.</p>
          <PropertySearch />
          <div className="hero-proof"><span><strong>24+</strong> years serving Prakasam</span><span><strong>Manual</strong> listing verification</span><span><strong>Local</strong> legal backend support</span></div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-heading"><div><p className="eyebrow">Carefully reviewed</p><h2>Featured opportunities in Ongole</h2></div><Link className="arrow-link" href="/properties">View all properties →</Link></div>
        <div className="property-grid">{sampleProperties.map((property) => <PropertyCard key={property.id} property={property} />)}</div>
      </section>

      <section className="trust-band"><div className="shell split-section"><div><p className="eyebrow">A property platform with roots</p><h2>Technology for discovery.<br />People for the decisions.</h2></div><div className="trust-copy"><p>We combine a professional digital marketplace with two decades of local market knowledge. Every listing stays under manual approval, and sensitive owner details remain protected unless visibility is explicitly authorised.</p><Link className="button button-light" href="/about">Why clients trust us</Link></div></div></section>

      <section className="section shell">
        <div className="section-heading"><div><p className="eyebrow">Explore by need</p><h2>Property services for every stage</h2></div></div>
        <div className="service-grid">
          <Link href="/properties?category=residential"><span>01</span><h3>Residential</h3><p>Apartments, villas, independent homes and open plots.</p></Link>
          <Link href="/properties?category=commercial"><span>02</span><h3>Commercial</h3><p>Offices, shops, showrooms, warehouses and industrial spaces.</p></Link>
          <Link href="/properties?category=agricultural"><span>03</span><h3>Agricultural</h3><p>Farm lands, horticulture land and long-term investments.</p></Link>
          <Link href="/paying-guest"><span>04</span><h3>Paying Guest</h3><p>Men&apos;s, women&apos;s, family and co-living accommodation.</p></Link>
        </div>
      </section>

      <section className="section process-section"><div className="shell"><p className="eyebrow">A clearer path to property</p><h2>From search to supported transaction</h2><ol className="process-list"><li><b>01</b><span><strong>Discover</strong>Search verified listings with practical filters.</span></li><li><b>02</b><span><strong>Enquire</strong>Tell our team what you need without exposing private owner data.</span></li><li><b>03</b><span><strong>Visit &amp; verify</strong>Coordinate visits and review property information.</span></li><li><b>04</b><span><strong>Proceed confidently</strong>Get documentation and transaction support.</span></li></ol></div></section>

      <section className="section shell cta-panel"><div><p className="eyebrow">Have a property to market?</p><h2>Reach genuine buyers with a professionally reviewed listing.</h2></div><div><Link className="button" href="/post-property">Post your property free</Link><a className="arrow-link" href="https://wa.me/919988767689">Speak on WhatsApp →</a></div></section>
    </main>
  );
}
