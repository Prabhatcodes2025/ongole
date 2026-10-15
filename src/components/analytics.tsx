/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import Script from "next/script";
import {useState} from "react";
import {PublicPageAnalytics} from "@/src/components/public-page-analytics";

const CONSENT_KEY="ongoleproperty.analytics-consent";
export function Analytics({measurementId,metaPixelId}:{measurementId?:string;metaPixelId?:string}){
  const[consent,setConsent]=useState<"unknown"|"granted"|"essential">(()=>{try{if(typeof window!=="undefined"){const value=localStorage.getItem(CONSENT_KEY);if(value==="granted"||value==="essential")return value}}catch{/* Consent controls remain usable when storage is unavailable. */}return"unknown"});
  function choose(value:"granted"|"essential"){try{localStorage.setItem(CONSENT_KEY,value)}catch{/* Apply for this page even when storage is unavailable. */}setConsent(value);window.dispatchEvent(new CustomEvent("op:analytics-consent",{detail:value}))}
  const allowed=consent==="granted";
  return <><PublicPageAnalytics/>{consent==="unknown"&&<aside className="cookie-consent" aria-label="Analytics consent"><p>We use privacy-safe site analytics. Optional Google and Meta tracking runs only with your permission. <a href="/cookie-policy">Cookie policy</a></p><div><button className="button button-small" onClick={()=>choose("granted")}>Allow analytics</button><button className="button button-light button-small" onClick={()=>choose("essential")}>Essential only</button></div></aside>}{allowed&&measurementId&&<><Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive"/><Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${measurementId.replace(/[^A-Z0-9-]/gi,"")}',{anonymize_ip:true});`}</Script></>}{allowed&&metaPixelId&&<Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId.replace(/\D/g,"")}');window.dispatchEvent(new Event('op:meta-ready'));`}</Script>}</>;
}
