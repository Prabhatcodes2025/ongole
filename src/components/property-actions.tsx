"use client";

import { Bookmark, Check, Copy, Mail, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function PropertyActions({title,authenticated,returnPath,url}:{title:string;authenticated:boolean;returnPath:string;url:string}) {
  const [copied,setCopied]=useState(false);
  const markCopied=()=>{setCopied(true);window.setTimeout(()=>setCopied(false),2000)};
  const share=async()=>{const data={title,text:`View ${title} on OngoleProperty.com`,url:window.location.href};if(navigator.share)await navigator.share(data).catch(()=>undefined);else{await navigator.clipboard.writeText(data.url);markCopied()}};
  return <div className="property-actions"><button onClick={share}><Share2/>Share</button><button onClick={async()=>{await navigator.clipboard.writeText(window.location.href);markCopied()}}>{copied?<Check/>:<Copy/>}{copied?"Copied":"Copy link"}</button><a href={`https://wa.me/?text=${encodeURIComponent(`View ${title} on OngoleProperty.com: ${url}`)}`} target="_blank" rel="noreferrer"><Share2/>WhatsApp</a><a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`View this property on OngoleProperty.com: ${url}`)}`}><Mail/>Email</a><button onClick={()=>window.print()}><Printer/>Print</button>{authenticated?<button title="Favorites dashboard is planned for a later sprint"><Bookmark/>Save</button>:<Link href={`/login?returnTo=${encodeURIComponent(returnPath)}`}><Bookmark/>Sign in to save</Link>}</div>;
}
