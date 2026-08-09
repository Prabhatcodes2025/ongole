import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AboutPage } from "@/src/components/public/about-page";
import { ContactPage } from "@/src/components/public/contact-page";
import { AgentsPage } from "@/src/components/public/agents-page";
import { siteConfig } from "@/src/config/site";
import { legalAliases, legalPages } from "@/src/content/legal-pages";

const pages: Record<string, { title: string; eyebrow: string; intro: string; sections: { title: string; body: string; href?: string }[] }> = {
  services: { title: "Property support before, during and after the decision", eyebrow: "Our services", intro: "Professional marketing and coordination across residential, commercial, agricultural, industrial, rental and NRI property needs.", sections: [{ title: "Buying & selling", body: "Requirement discovery, property marketing, buyer-seller coordination, site visit support and transaction follow-up." }, { title: "Documentation support", body: "Guidance around property documentation, preliminary verification and coordination with experienced legal professionals. This is not a substitute for independent legal due diligence." }, { title: "Property trace & recovery", body: "A specialist premium assistance service for tracing forgotten ancestral properties, inherited land, old open plots and legacy records." }] },
  "advertise-with-us": { title: "Reach people actively exploring property", eyebrow: "Advertise with OngoleProperty", intro: "Advertisement placements are prepared for relevant, administrator-approved campaigns across the public property experience.", sections: [{ title: "Planned placements", body: "Hero, flash, scrolling and property-detail sidebar positions are available. Campaign activation and scheduling remain administrator controlled." }, { title: "Responsible presentation", body: "Empty placements collapse automatically, and every configured campaign has a title, destination, approval state and start and end dates." }] },
};

function resolveLegalPage(slug:string){const canonicalSlug=legalAliases[slug]||slug;return legalPages[canonicalSlug]}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if(slug==="about"){
    const description="OngoleProperty.com is a trusted real estate platform serving Ongole and Prakasam District. Discover verified residential, commercial, agricultural and farm properties, connect with trusted property owners and agents, and access professional property tracing and dedicated NRI property services.";
    return{title:"About OngoleProperty.com | Trusted Local Real Estate Platform",description,alternates:{canonical:"/about"},openGraph:{title:"About OngoleProperty.com",description,url:"/about",type:"website"},twitter:{card:"summary_large_image",title:"About OngoleProperty.com",description}};
  }
  if(slug==="contact"){
    const description="Contact OngoleProperty.com for property enquiries, sales and advertising, NRI services and professional real estate support in Ongole and Prakasam District.";
    return{title:"Contact OngoleProperty.com",description,alternates:{canonical:"/contact"},openGraph:{title:"Contact OngoleProperty.com",description,url:"/contact",type:"website"},twitter:{card:"summary_large_image",title:"Contact OngoleProperty.com",description}};
  }
  if(slug==="agents"){
    const description="Register as a real estate agent serving Ongole and Prakasam District. Profiles remain pending until administrator review and verification.";
    return{title:"Real Estate Agent Registration in Ongole",description,alternates:{canonical:"/agents"},openGraph:{title:"Real Estate Agent Registration in Ongole",description,url:"/agents",type:"website"},twitter:{card:"summary_large_image",title:"Real Estate Agent Registration in Ongole",description}};
  }
  const legal=resolveLegalPage(slug);
  if(legal)return{title:legal.title,description:legal.intro,alternates:{canonical:legal.canonical}};
  const page = pages[slug];
  return page ? { title: page.title, description: page.intro, alternates: { canonical: `/${slug}` } } : {};
}

export function generateStaticParams() {
  return [...Object.keys(pages),"about","contact","agents",...Object.keys(legalPages),...Object.keys(legalAliases)].map((slug) => ({ slug }));
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const legal=resolveLegalPage(slug);
  const page = pages[slug];
  if(slug==="about")return <AboutPage/>;
  if(slug==="contact")return <ContactPage/>;
  if(slug==="agents")return <AgentsPage/>;
  if (!legal&&!page) notFound();
  if(legal)return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">{legal.eyebrow}</p><h1>{legal.title}</h1><p>{legal.intro}</p><p className="policy-effective">Effective: {legal.effectiveDate}</p></div></section><section className="section shell editorial-grid legal-grid"><div>{legal.sections.map((section)=><article key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph)=><p key={paragraph}>{paragraph}</p>)}{section.items&&<ul>{section.items.map((item)=><li key={item}>{item}</li>)}</ul>}</article>)}</div><aside><p className="eyebrow">Policy support</p><h2>Questions or concerns?</h2><p>Contact our team and include the relevant account, listing, payment, or enquiry reference.</p><a className="button" href={`mailto:${siteConfig.email}`}>Email support</a><Link className="arrow-link" href="/contact-grievance-policy">Grievance process →</Link></aside></section></main>;
  return <main id="main"><section className="inner-hero editorial"><div className="shell"><p className="eyebrow">{page.eyebrow}</p><h1>{page.title}</h1><p>{page.intro}</p></div></section><section className="section shell editorial-grid"><div>{page.sections.map((section) => <article key={section.title}><h2>{section.title}</h2><p>{section.href ? <a href={section.href}>{section.body}</a> : section.body}</p></article>)}</div><aside><p className="eyebrow">Need assistance?</p><h2>Speak with our team</h2><p>Property enquiries are accepted around the clock.</p><a className="button" href={siteConfig.phoneHref}>Call {siteConfig.phone}</a><Link className="arrow-link" href="/contact">All contact options →</Link></aside></section></main>;
}
