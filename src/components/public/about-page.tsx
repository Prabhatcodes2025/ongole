import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Eye,
  Handshake,
  Landmark,
  MapPinned,
  Network,
  SearchCheck,
  ShieldCheck,
  Users,
} from "lucide-react";
import { siteConfig } from "@/src/config/site";

const services = [
  "Residential Properties",
  "Commercial Properties",
  "Agricultural Lands",
  "Farm Lands",
  "Villas",
  "Apartments",
  "Independent Houses",
  "Open Plots",
  "Rental Properties",
  "Paying Guest Accommodation",
  "Property Marketing",
  "Property Search Assistance",
  "Property Verification Support",
  "Real Estate Agent Network",
  "Dedicated NRI Property Services",
  "Property Tracing Services",
];

const trustPoints = [
  [BadgeCheck, "Responsible property listings"],
  [ShieldCheck, "Manual review before publishing"],
  [Eye, "Genuine property information"],
  [Handshake, "Transparent communication"],
  [MapPinned, "Local market expertise"],
  [Network, "Professional coordination"],
  [Users, "Respect for customer privacy"],
  [Landmark, "Long-term customer relationships"],
] as const;

const experience = [
  "Property Marketing",
  "Local Market Understanding",
  "Property Identification",
  "Revenue Record Awareness",
  "Property Documentation Guidance",
  "Customer Coordination",
  "Property Listing Management",
  "Local Property Research",
  "Professional Real Estate Networking",
];

const commitment = [
  "Genuine property information",
  "Responsible listing standards",
  "Transparent communication",
  "Customer privacy",
  "Ethical real estate practices",
  "Continuous platform improvement",
  "Professional customer support",
];

const differentiators = [
  "Trusted Since 2002",
  "Local Market Expertise",
  "Professional Property Marketing",
  "Property Verification Support",
  "Dedicated NRI Property Services",
  "Property Tracing Services",
  "Responsible Property Listings",
  "Professional Real Estate Network",
  "Serving Ongole & Prakasam District",
];

export function AboutPage() {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "About Us", item: `${siteConfig.url}/about` },
    ],
  };

  return <main id="main" className="about-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
    <section className="about-hero"><div className="shell about-hero-grid"><div><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><b>›</b><span>About Us</span></nav><p className="eyebrow">About OngoleProperty.com</p><h1>A trusted, locally focused real estate platform</h1><p>Connecting genuine property owners, buyers, sellers, tenants, investors and real estate professionals across Ongole and Prakasam District.</p><div className="button-row"><Link className="button" href="/properties">Explore Properties</Link><Link className="button button-outline" href="/contact">Contact Us</Link></div></div><div className="about-hero-mark" aria-hidden="true"><Building2/><strong>Local knowledge</strong><span>Professional property coordination</span></div></div></section>

    <section className="section shell about-intro"><div><p className="eyebrow">Who we are</p><h2>Quality property information for confident decisions</h2></div><div><p>OngoleProperty.com is a trusted real estate platform dedicated to serving Ongole and Prakasam District. Our mission is to connect genuine property owners, buyers, sellers, tenants, investors and real estate professionals through a transparent and professionally managed platform.</p><p>We believe every property transaction should be based on trust, verified information and local market knowledge. Rather than focusing only on the number of listings, our priority is to provide quality property information that helps people make informed decisions with confidence.</p></div></section>

    <section className="section section-tinted"><div className="shell"><div className="section-heading"><div><p className="eyebrow">What we do</p><h2>Property discovery, marketing and professional support</h2></div><p>Our objective is to make buying, selling and renting properties easier, more transparent and more professional.</p></div><ul className="about-service-grid">{services.map((service)=><li key={service}><SearchCheck aria-hidden="true"/><span>{service}</span></li>)}</ul></div></section>

    <section className="section shell"><div className="section-heading"><div><p className="eyebrow">Why people trust us</p><h2>Trust is the foundation of every successful property transaction</h2></div><p>At OngoleProperty.com we believe in quality rather than quantity.</p></div><div className="about-trust-grid">{trustPoints.map(([Icon, label])=><article key={label}><Icon aria-hidden="true"/><h3>{label}</h3></article>)}</div></section>

    <section className="section trust-band"><div className="shell about-difference"><div><p className="eyebrow">How we are different</p><h2>More than a place to publish advertisements</h2></div><div><p>OngoleProperty.com is designed to provide a more responsible and locally focused property experience. Our objective is not only to display properties but also to help people make better property decisions.</p><p>We combine strong local market knowledge, professional property marketing, responsible publishing, property verification support, property tracing, dedicated NRI services, a real estate agent network and professional customer guidance.</p></div></div></section>

    <section className="section shell"><div className="section-heading"><div><p className="eyebrow">Our unique services</p><h2>Specialist support for complex property needs</h2></div></div><div className="unique-service-grid"><article><MapPinned aria-hidden="true"/><h3>Property Tracing Services</h3><p>Finding an ancestral property or an old purchased property can be difficult.</p><p>OngoleProperty.com provides professional Property Tracing Services to help identify such properties using registered documents, survey records and available land information. Where possible, we also assist in identifying the physical location and boundaries based on available records.</p><Link className="arrow-link" href="/nri-services-ongole#property-tracing">Learn about property tracing →</Link></article><article><Users aria-hidden="true"/><h3>Dedicated NRI Property Services</h3><p>Trusted Property Services for NRIs with End-to-End Professional Assistance.</p><ul><li>Property Purchase Assistance</li><li>Property Sale Assistance</li><li>Property Verification</li><li>Property Management Coordination</li><li>Documentation Support</li><li>Local Site Coordination</li><li>Professional Communication</li></ul><a className="arrow-link" href={`mailto:${siteConfig.nriEmail}`}>{siteConfig.nriEmail} →</a></article></div></section>

    <section className="section section-tinted"><div className="shell about-three-column"><article><p className="eyebrow">Our role</p><h2>A professional bridge</h2><p>OngoleProperty.com acts as a professional bridge between property owners, buyers, sellers, landlords, tenants, investors, builders, developers, real estate agents and Non-Resident Indians. We simplify communication, improve property visibility and help create meaningful real estate opportunities.</p></article><article><p className="eyebrow">Our experience</p><h2>Practical local understanding</h2><ul>{experience.map((item)=><li key={item}>{item}</li>)}</ul></article><article><p className="eyebrow">Our commitment</p><h2>Integrity and transparency</h2><p>Our commitment is to build a trusted real estate platform based on integrity, transparency and long-term customer relationships.</p><ul>{commitment.map((item)=><li key={item}>{item}</li>)}</ul></article></div></section>

    <section className="section shell"><div className="section-heading"><div><p className="eyebrow">Why choose OngoleProperty.com</p><h2>Local focus. Responsible standards. Professional support.</h2></div></div><ul className="about-choice-grid">{differentiators.map((item)=><li key={item}><BadgeCheck aria-hidden="true"/>{item}</li>)}</ul></section>

    <section className="section shell cta-panel"><div><p className="eyebrow">Start your property journey</p><h2>Discover properties or speak with our local team.</h2></div><div className="cta-actions"><Link className="button" href="/properties">View Properties</Link><Link className="button button-outline" href="/agents">Real Estate Agents</Link><Link className="arrow-link" href="/contact">Contact Us →</Link></div></section>
  </main>;
}
