"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { PropertySearch } from "@/src/components/property-search";
import type {PropertyCatalogData} from "@/src/config/property-catalog";

const slides = [
  { label:"Apartment", image:"/images/hero/apartment.webp", alt:"Contemporary apartment community in warm morning light", title:"Apartments made easier to discover.", copy:"Browse professionally reviewed apartment opportunities across Ongole." },
  { label:"Villa", image:"/images/hero/villa.webp", alt:"Contemporary villa with landscaped garden", title:"More room for the life ahead.", copy:"Explore villas and independent homes with practical local support." },
  { label:"Open Plot", image:"/images/hero/open-plot.webp", alt:"Residential open plots with an approach road", title:"Find the right place to build.", copy:"Compare open plots by location, area, access and budget." },
  { label:"Commercial", image:"/images/hero/commercial.webp", alt:"Modern commercial office property", title:"Space for the next business move.", copy:"Discover shops, offices and commercial opportunities in growing locations." },
  { label:"Agricultural Land", image:"/images/hero/agricultural.webp", alt:"Agricultural fields in Prakasam District", title:"Land opportunities, understood locally.", copy:"Search agricultural and farm land across Prakasam District." },
];

export function HeroSlider({catalog}:{catalog:PropertyCatalogData}) {
  const [active,setActive]=useState(0); const [paused,setPaused]=useState(false);
  useEffect(()=>{if(paused)return;const timer=window.setInterval(()=>setActive((index)=>(index+1)%slides.length),5000);return()=>window.clearInterval(timer);},[paused]);
  const move=(direction:number)=>setActive((index)=>(index+direction+slides.length)%slides.length); const slide=slides[active];
  return <section className="hero-slider" aria-roledescription="carousel" aria-label="Property categories" tabIndex={0} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={(event)=>!event.currentTarget.contains(event.relatedTarget)&&setPaused(false)} onKeyDown={(event)=>{if(event.key==="ArrowLeft")move(-1);if(event.key==="ArrowRight")move(1);}}>
    <div className="hero-slides">{slides.map((item,index)=><div key={item.label} className={`hero-slide ${index===active?"is-active":""}`} aria-hidden={index!==active}><Image src={item.image} alt={item.alt} fill priority={index===0} sizes="100vw"/></div>)}</div><div className="hero-overlay"/>
    <div className="shell hero-slider-content"><p className="eyebrow">Ongole&apos;s trusted property partner since 2002</p><p className="slide-label">{slide.label}</p><h1>{slide.title}</h1><p className="hero-copy">{slide.copy}</p><PropertySearch catalog={catalog}/><div className="hero-proof"><span><strong>24+</strong> years serving Prakasam</span><span><strong>Manual</strong> listing verification</span><span><strong>Local</strong> transaction support</span></div></div>
    <button className="slider-control previous" type="button" onClick={()=>move(-1)} aria-label="Previous property category"><ChevronLeft/></button><button className="slider-control next" type="button" onClick={()=>move(1)} aria-label="Next property category"><ChevronRight/></button>
    <div className="slider-dots" role="tablist" aria-label="Choose property category">{slides.map((item,index)=><button key={item.label} role="tab" aria-selected={index===active} aria-label={`Show ${item.label}`} onClick={()=>setActive(index)}/>)}</div><p className="sr-only" aria-live="polite">Showing {slide.label}</p>
  </section>;
}
