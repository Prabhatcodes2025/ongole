"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type NriFaqItem={question:string;answer:string};

export function NriFaq({items}:{items:NriFaqItem[]}){
  const[open,setOpen]=useState<number|null>(0);
  return <div className="nri-faq-list">{items.map((item,index)=>{const expanded=open===index;const panel=`nri-faq-panel-${index}`,button=`nri-faq-button-${index}`;return <article key={item.question}><h3><button id={button} type="button" aria-expanded={expanded} aria-controls={panel} onClick={()=>setOpen(expanded?null:index)}>{item.question}<ChevronDown aria-hidden="true"/></button></h3><div id={panel} role="region" aria-labelledby={button} hidden={!expanded}><p>{item.answer}</p></div></article>})}</div>;
}
