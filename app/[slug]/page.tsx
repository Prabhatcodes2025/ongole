import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { legalAliases, legalPages } from "@/src/content/legal-pages";

const pages: Record<string, { title: string; eyebrow: string; intro: string; sections: { title: string; body: string }[] }> = {
  about: { title: "Built on local knowledge and long-term trust", eyebrow: "About OngoleProperty.com", intro: "Since 2002, Kosana Associates LLP has helped people across Ongole and Prakasam District market, discover and evaluate property opportunities with clarity.", sections: [{ title: "Our role", body: "We are a corporate real estate marketing platform—not a layout developer or construction company. We connect genuine buyers, sellers, landlords, tenants, investors and NRIs through professional listing, coordination and support." }, { title: "Experience", body: "Driven by real estate professionals with legal background and revenue knowledge." }, { title: "Our commitment", body: "Manual listing approval, responsible contact visibility and clear transaction support are built into the operating model." }] },
  services: { title: "Property support before, during and after the decision", eyebrow: "Our services", intro: "Professional marketing and coordination across residential, commercial, agricultural, industrial, rental and NRI property needs.", sections: [{ title: "Buying & selling", body: "Requirement discovery, property marketing, buyer-seller coordination, site visit support and transaction follow-up." }, { title: "Documentation support", body: "Guidance around property documentation, preliminary verification and coordination with experienced legal professionals. This is not a substitute for independent legal due diligence." }, { title: "Property trace & recovery", body: "A specialist premium assistance service for tracing forgotten ancestral properties, inherited land, old open plots and legacy records." }] },
  contact: { title: "Talk to a local property professional", eyebrow: "Contact & support", intro: "Our digital platform accepts enquiries 24 hours a day, seven days a week. The team responds at the earliest practical opportunity.", sections: [{ title: "Voice call", body: "+91 77889 98459" }, { title: "WhatsApp", body: "+91 99887 67689" }, { title: "Office", body: "4th Lane, Bhagya Nagar, Ongole, Prakasam District, Andhra Pradesh, India." }] },
  agents: { title: "A verified local agent network", eyebrow: "Real estate agents", intro: "Verified, active property professionals can join our network and serve up to five working towns with declared specialisations.", sections: [{ title: "Verification first", body: "Only agents reviewed by an administrator and marked verified and active may appear publicly." }, { title: "Professional profiles", body: "Profiles can include service towns, property specialisations, years of experience, office address and an administrator-reviewed introduction." }] },
  "paying-guest": { title: "Paying guest and co-living in Ongole", eyebrow: "PG accommodation", intro: "Discover reviewed men's PG, women's PG, family PG and co-living options with transparent facilities and house rules.", sections: [{ title: "Practical filters", body: "Search by category, monthly rent, room type, food, furnishing, bathroom type and occupant preference." }, { title: "Same approval standards", body: "PG listings inherit the same image processing, enquiry management, SEO, audit and security architecture as property listings." }] },
  "advertise-with-us": { title: "Reach people actively exploring property", eyebrow: "Advertise with OngoleProperty", intro: "Advertisement placements are prepared for relevant, administrator-approved campaigns across the public property experience.", sections: [{ title: "Planned placements", body: "Hero, flash, scrolling and property-detail sidebar positions are available. Campaign activation and scheduling remain administrator controlled." }, { title: "Responsible presentation", body: "Empty placements collapse automatically, and every configured campaign has a title, destination, approval state and start and end dates." }] },
};

function resolveLegalPage(slug:string){const canonicalSlug=legalAliases[slug]||slug;return legalPages[canonicalSlug]}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const legal=resolveLegalPage(slug);
  if(legal)return{title:legal.title,description:legal.intro,alternates:{canonical:legal.canonical}};
  const page = pages[slug];
  return page ? { title: page.title, description: page.intro, alternates: { canonical: `/${slug}` } } : {};
}

export function generateStaticParams() {
  return [...Object.keys(pages),...Object.keys(legalPages),...Object.keys(legalAliases)].map((slug) => ({ slug }));
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const legal=resolveLegalPage(slug);
  const page = pages[slug];
  if (!legal&&!page) notFound();
  if(legal)return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">{legal.eyebrow}</p><h1>{legal.title}</h1><p>{legal.intro}</p><p className="policy-effective">Effective: {legal.effectiveDate}</p></div></section><section className="section shell editorial-grid legal-grid"><div>{legal.sections.map((section)=><article key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph)=><p key={paragraph}>{paragraph}</p>)}{section.items&&<ul>{section.items.map((item)=><li key={item}>{item}</li>)}</ul>}</article>)}</div><aside><p className="eyebrow">Policy support</p><h2>Questions or concerns?</h2><p>Contact our team and include the relevant account, listing, payment, or enquiry reference.</p><a className="button" href="mailto:admin@ongoleproperty.com">Email support</a><Link className="arrow-link" href="/contact-grievance-policy">Grievance process →</Link></aside></section></main>;
  return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">{page.eyebrow}</p><h1>{page.title}</h1><p>{page.intro}</p></div></section><section className="section shell editorial-grid"><div>{page.sections.map((section) => <article key={section.title}><h2>{section.title}</h2><p>{section.body}</p></article>)}</div><aside><p className="eyebrow">Need assistance?</p><h2>Speak with our team</h2><p>Property enquiries are accepted around the clock.</p><a className="button" href="tel:+917788998459">Call +91 77889 98459</a><Link className="arrow-link" href="/contact">All contact options →</Link></aside></section></main>;
}
