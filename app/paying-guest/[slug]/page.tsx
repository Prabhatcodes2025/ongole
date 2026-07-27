import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {EnquiryForm} from "@/src/components/enquiry-form";
import {PropertyGallery} from "@/src/components/property-gallery";
import {siteConfig} from "@/src/config/site";
import {getPublicPg,getPublicPgSlugs,getSimilarPgs} from "@/src/lib/pg/public";
import {youtubeVideoId} from "@/src/lib/youtube";

export const revalidate=300;
export async function generateStaticParams(){return(await getPublicPgSlugs(100)).map(({slug})=>({slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;const pg=await getPublicPg(slug);if(!pg)return{};
  const description=`${pg.name}, ${pg.category.replaceAll("_"," ")} paying guest accommodation in ${pg.locality}, ${pg.city}. Rent from ₹${pg.rent.toLocaleString("en-IN")} per bed.`;
  const image=pg.media[0]?.url;return{title:`${pg.name} in ${pg.locality}`,description,alternates:{canonical:`/paying-guest/${pg.slug}`},openGraph:{title:pg.name,description,url:`/paying-guest/${pg.slug}`,type:"website",images:image?[{url:image,alt:pg.name}]:undefined},twitter:{card:"summary_large_image",title:pg.name,description,images:image?[image]:undefined}};
}

export default async function PgDetailsPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const pg=await getPublicPg(slug);if(!pg)notFound();const similar=await getSimilarPgs(pg);
  const totalAvailable=pg.rooms.reduce((sum,room)=>sum+room.availableBeds,0);
  const schema={"@context":"https://schema.org","@type":"LodgingBusiness",name:pg.name,url:`${siteConfig.url}/paying-guest/${pg.slug}`,description:pg.description,image:pg.media.map((item)=>item.url),address:{"@type":"PostalAddress",streetAddress:pg.address,addressLocality:pg.locality,addressRegion:pg.state,addressCountry:"IN"},amenityFeature:pg.amenities.map((name)=>({"@type":"LocationFeatureSpecification",name,value:true})),priceRange:`₹${pg.rent}+ per month`,telephone:siteConfig.phone};
  return <main id="main"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/><section className="detail-head shell"><nav className="breadcrumbs"><Link href="/">Home</Link><b>›</b><Link href="/paying-guest">Paying guest</Link><b>›</b><span>{pg.name}</span></nav><div className="detail-title"><div><div className="badge-row static">{pg.verified&&<span className="badge">Verified</span>}{pg.featured&&<span className="badge badge-warm">Featured</span>}</div><p className="property-meta">{pg.reference} · {pg.category.replaceAll("_"," ")}</p><h1>{pg.name}</h1><p>{pg.address}, {pg.locality}, {pg.city}</p></div><div className="detail-price"><strong>₹{pg.rent.toLocaleString("en-IN")}/month</strong><span>Starting rent per bed</span></div></div><nav className="detail-section-nav"><a href="#rooms">Rooms</a><a href="#amenities">Amenities</a><a href="#location">Map</a><a href="#enquiry">Enquire</a></nav></section>
    <section className="shell detail-grid"><div className="detail-main"><PropertyGallery media={pg.media.map((item,index)=>({id:item.id,url:item.url,alt:item.alt,isCover:index===0}))} title={pg.name}/>
      <section className="detail-section"><h2>About this PG</h2><p>{pg.description}</p><dl className="fact-grid"><div><dt>PG type</dt><dd>{pg.category.replaceAll("_"," ")}</dd></div><div><dt>Availability</dt><dd>{totalAvailable} beds</dd></div>{pg.capacity&&<div><dt>Total capacity</dt><dd>{pg.capacity}</dd></div>}{pg.deposit!=null&&<div><dt>Typical deposit</dt><dd>₹{pg.deposit.toLocaleString("en-IN")}</dd></div>}</dl></section>
      <section className="detail-section" id="rooms"><h2>Room types and pricing</h2><div className="admin-table"><div className="admin-row admin-head"><span>Room</span><span>Sharing</span><span>Availability</span><span>Monthly rent</span><span>Deposit</span></div>{pg.rooms.map((room)=><div className="admin-row" key={room.id}><span><strong>{room.name}</strong></span><span>{room.sharing.replaceAll("_"," ")}</span><span>{room.availableBeds}/{room.capacity} beds</span><span>₹{room.rent.toLocaleString("en-IN")}</span><span>{room.deposit==null?"—":`₹${room.deposit.toLocaleString("en-IN")}`}</span></div>)}</div></section>
      <section className="detail-section" id="amenities"><h2>Amenities</h2><ul className="amenity-list">{pg.amenities.map((item)=><li key={item}>{item}</li>)}</ul></section>
      {pg.rules.length>0&&<section className="detail-section"><h2>House rules</h2><ul className="highlight-list">{pg.rules.map((item)=><li key={item}>{item}</li>)}</ul></section>}
      {pg.videos.map((video)=>{const id=youtubeVideoId(video);return id?<section className="detail-section" key={video}><h2>PG video</h2><div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title={`${pg.name} video`} loading="lazy" allowFullScreen/></div></section>:null})}
      <section className="detail-section" id="location"><h2>Map and location</h2><p>{pg.address}, {pg.locality}, {pg.city}, {pg.district}, {pg.state}</p>{pg.latitude!=null&&pg.longitude!=null&&<div className="map-frame"><iframe title={`Map for ${pg.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${pg.latitude},${pg.longitude}&z=15&output=embed`}/></div>}</section>
      {similar.length>0&&<section className="detail-section"><h2>Similar PGs</h2><div className="feature-grid">{similar.map((item)=><article key={item.id}><p className="eyebrow">{item.locality}</p><h3><Link href={`/paying-guest/${item.slug}`}>{item.name}</Link></h3><p>From ₹{item.rent.toLocaleString("en-IN")}/bed</p></article>)}</div></section>}
    </div><aside className="enquiry-card" id="enquiry"><p className="eyebrow">Interested?</p><h2>Request details or a visit</h2><EnquiryForm propertyReference={pg.reference} propertyTitle={pg.name} captchaSiteKey={process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY}/><div className="contact-options"><a href={siteConfig.phoneHref}>Call OngoleProperty</a><a href={siteConfig.whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a></div></aside></section><div className="mobile-contact-bar"><a href={siteConfig.phoneHref}>Call</a><a href={siteConfig.whatsappHref}>WhatsApp</a><a href="#enquiry">Enquire</a></div>
  </main>;
}
