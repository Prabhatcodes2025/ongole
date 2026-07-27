"use client";

import Script from "next/script";
import {PublicPageAnalytics} from "@/src/components/public-page-analytics";

export function Analytics({measurementId}:{measurementId?:string}){
  return <><PublicPageAnalytics/>{measurementId&&<><Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive"/><Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${measurementId.replace(/[^A-Z0-9-]/gi,"")}',{anonymize_ip:true});`}</Script></>}</>;
}
