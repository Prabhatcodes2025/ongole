"use client";

import { Check, Copy, Mail, Printer, Share2 } from "lucide-react";
import { useState } from "react";

export function PropertyActions({title,url}:{title:string;url:string}) {
  const [copied,setCopied]=useState(false);
  const markCopied=()=>{setCopied(true);window.setTimeout(()=>setCopied(false),2000)};
  const share=async()=>{const data={title,text:`View ${title} on OngoleProperty.com`,url:window.location.href};if(navigator.share)await navigator.share(data).catch(()=>undefined);else{await navigator.clipboard.writeText(data.url);markCopied()}};
  return <div className="property-actions" aria-label="Property sharing options"><button onClick={share}><Share2 aria-hidden="true"/>Share</button><button onClick={async()=>{await navigator.clipboard.writeText(window.location.href);markCopied()}}>{copied?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}{copied?"Copied":"Copy link"}</button><a href={`https://wa.me/?text=${encodeURIComponent(`View ${title} on OngoleProperty.com: ${url}`)}`} target="_blank" rel="noreferrer"><Share2 aria-hidden="true"/>WhatsApp</a><a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`View this property on OngoleProperty.com: ${url}`)}`}><Mail aria-hidden="true"/>Email</a><button onClick={()=>window.print()}><Printer aria-hidden="true"/>Print</button><span className="sr-only" aria-live="polite">{copied?"Property link copied to clipboard":""}</span></div>;
}
