import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Building2, MapPinned, MessageSquareHeart, Network, SearchCheck, UserRoundCheck } from "lucide-react";
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

const reasons=[{Icon:BadgeCheck,title:"Verified property listings",copy:"Only manually published records enter the public catalogue."},{Icon:UserRoundCheck,title:"Verified property owners",copy:"Owner identity and listing authority can be reviewed before publication."},{Icon:Network,title:"Corporate real estate network",copy:"Local property marketing backed by Kosana Associates LLP."},{Icon:SearchCheck,title:"Easy property search",copy:"Search by purpose, category, type, location, price and practical details."},{Icon:MapPinned,title:"Trusted local platform",copy:"Focused on Ongole and the wider Prakasam District since 2002."}];

export default async function Home(){const [featured,catalog,scrollingAd,heroAd,flashAd]=await Promise.all([getFeaturedProperties(6),getPublicPropertyCatalog(),getActiveAdvertisement("scrolling"),getActiveAdvertisement("hero"),getActiveAdvertisement("flash")]);return <main id="main">
  {scrollingAd&&<div className="top-ad shell"><AdSlot title={scrollingAd.title} image={scrollingAd.image} alt={scrollingAd.alt} href={scrollingAd.href} className="ad-scroll"/></div>}
  <HeroSlider catalog={catalog}/>
  {heroAd&&<div className="shell"><AdSlot title={heroAd.title} image={heroAd.image} alt={heroAd.alt} href={heroAd.href} className="ad-hero"/></div>}
  <section className="section home-latest section-tinted"><div className="shell"><SectionHeading eyebrow="Carefully reviewed" title="Featured and latest properties" action={<Link className="arrow-link" href="/properties">View all properties →</Link>}/>{featured.length?<div className="property-grid">{featured.map((property)=><PropertyCard key={property.id} property={property}/>)}</div>:<EmptyState title="No public properties yet" message="Approved listings will appear here as soon as they are published."/>}</div></section>
  <section className="section shell"><SectionHeading eyebrow="Why choose OngoleProperty" title="A clearer, safer way to discover local property"/><div className="reason-grid">{reasons.map(({Icon,title,copy})=><article key={title}><Icon aria-hidden="true"/><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
  {flashAd&&<div className="shell"><AdSlot title={flashAd.title} image={flashAd.image} alt={flashAd.alt} href={flashAd.href} className="ad-flash"/></div>}
  <section className="section trust-band"><div className="shell split-section"><div><p className="eyebrow">Local professionals, wider reach</p><h2>Connect with a reviewed real estate network.</h2></div><div className="trust-copy"><p>Agents can declare their working towns, experience and specialisations. Public profiles appear only after administrative verification.</p><Link className="button button-light" href="/register?accountType=agent">Register as Real Estate Agent</Link></div></div></section>
  <section className="section shell pg-intro"><div><p className="eyebrow">Accommodation in Ongole</p><h2>Paying guest and co-living, ready for future listings.</h2><p>The PG discovery module is being prepared with the same review and privacy standards as property listings.</p><div className="button-row"><Link className="button" href="/paying-guest?category=mens">Men&apos;s PG</Link><Link className="button button-outline" href="/paying-guest?category=womens">Women&apos;s PG</Link><Link className="button button-outline" href="/paying-guest?category=co_living">Co-Living</Link></div></div><div className="pg-visual"><Building2 size={84} aria-hidden="true"/><span>Coming soon</span></div></section>
  <section className="section testimonials"><div className="shell"><SectionHeading eyebrow="Customer experiences" title={<><MessageSquareHeart className="consent-icon" aria-hidden="true"/>Feedback published only with consent</>}/><div className="testimonial-grid">{["Property buyer","Property owner","Local investor"].map((role)=><article key={role}><Image src="/ongole-property-logo.png" alt="" width={54} height={54}/><div><p>Verified customer feedback will appear here only after review and explicit publication consent.</p><strong>{role}</strong><span>Content awaiting approval</span></div></article>)}</div></div></section>
  <section className="section shell cta-panel"><div><p className="eyebrow">Ready for the next step?</p><h2>Discover, list or discuss property with a local team.</h2></div><div className="cta-actions"><Link className="button" href="/post-property">Post Property</Link><Link className="button button-outline" href="/register">Register</Link><Link className="arrow-link" href="/contact">Contact Us →</Link></div></section>
</main>}
