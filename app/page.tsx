import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, MapPinned, Network, SearchCheck, UserRoundCheck } from "lucide-react";
import { AdSlot } from "@/src/components/ad-slot";
import { HeroSlider } from "@/src/components/hero-slider";
import { PropertyCard } from "@/src/components/property-card";
import { EmptyState } from "@/src/components/public-states";
import { SectionHeading } from "@/src/components/section-heading";
import { getFeaturedProperties } from "@/src/lib/properties/public";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {getActiveAdvertisement} from "@/src/lib/advertisements/public";

export const revalidate=300;
export const metadata:Metadata={title:"OngoleProperty.com | Trusted Real Estate Since 2002",description:"Discover reviewed homes, plots, commercial spaces, rentals and agricultural land across Ongole and Prakasam District.",alternates:{canonical:"/"}};

const reasons=[{Icon:BadgeCheck,title:"Responsible property listings",copy:"Only manually reviewed and published records enter the public catalogue."},{Icon:UserRoundCheck,title:"Genuine property information",copy:"Owner details and listing information can be reviewed before publication."},{Icon:Network,title:"Professional coordination",copy:"A locally focused platform connecting owners, buyers, tenants, investors and agents."},{Icon:SearchCheck,title:"Easy property search",copy:"Search by purpose, category, type, location, price and practical details."},{Icon:MapPinned,title:"Local market expertise",copy:"Dedicated to property opportunities across Ongole and Prakasam District."}];

export default async function Home(){const [featured,catalog,scrollingAd,heroAd,flashAd]=await Promise.all([getFeaturedProperties(6),getPublicPropertyCatalog(),getActiveAdvertisement("scrolling"),getActiveAdvertisement("hero"),getActiveAdvertisement("flash")]);return <main id="main">
  {scrollingAd&&<div className="top-ad shell"><AdSlot title={scrollingAd.title} image={scrollingAd.image} alt={scrollingAd.alt} href={scrollingAd.href} className="ad-scroll"/></div>}
  <HeroSlider catalog={catalog}/>
  {heroAd&&<div className="shell"><AdSlot title={heroAd.title} image={heroAd.image} alt={heroAd.alt} href={heroAd.href} className="ad-hero"/></div>}
  <section className="section home-latest section-tinted"><div className="shell"><SectionHeading eyebrow="Carefully reviewed" title="Featured and latest properties" action={<Link className="arrow-link" href="/properties">View all properties →</Link>}/>{featured.length?<div className="property-grid">{featured.map((property)=><PropertyCard key={property.id} property={property}/>)}</div>:<EmptyState title="No public properties yet" message="Approved listings will appear here as soon as they are published."/>}</div></section>
  <section className="section shell"><SectionHeading eyebrow="Why choose OngoleProperty" title="A clearer, safer way to discover local property"/><div className="reason-grid">{reasons.map(({Icon,title,copy})=><article key={title}><Icon aria-hidden="true"/><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
  {flashAd&&<div className="shell"><AdSlot title={flashAd.title} image={flashAd.image} alt={flashAd.alt} href={flashAd.href} className="ad-flash"/></div>}
  <section className="section trust-band"><div className="shell split-section"><div><p className="eyebrow">Local professionals, wider reach</p><h2>Connect with a reviewed real estate network.</h2></div><div className="trust-copy"><p>Agents can declare their working towns, experience and specialisations. Public profiles appear only after administrative verification.</p><Link className="button button-light" href="/register?accountType=agent">Register as Real Estate Agent</Link></div></div></section>
  <section className="section shell pg-intro"><div><p className="eyebrow">Accommodation in Ongole</p><h2>Paying guest and co-living accommodation.</h2><p>Compare reviewed PG listings by rent, amenities and current availability.</p><div className="button-row"><Link className="button" href="/paying-guest?gender=mens">Men&apos;s PG</Link><Link className="button button-outline" href="/paying-guest?gender=womens">Women&apos;s PG</Link><Link className="button button-outline" href="/paying-guest?gender=co_living">Co-Living</Link></div></div><div className="pg-visual"><Building2 size={84} aria-hidden="true"/><span>Explore PGs</span></div></section>
  <section className="section shell cta-panel"><div><p className="eyebrow">Ready for the next step?</p><h2>Discover, list or discuss property with a local team.</h2></div><div className="cta-actions"><Link className="button" href="/post-property">Post Property</Link><Link className="button button-outline" href="/register">Register</Link><Link className="arrow-link" href="/contact">Contact Us →</Link></div></section>
</main>}
