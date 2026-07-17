"use client";

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { propertyCategories, propertyTypeLabels } from "@/src/config/property-catalog";

function propertyGroups(purpose: "sale" | "rent") {
  return propertyCategories.map((category) => ({ label: category.label, items: category.types.map((type) => ({ label: propertyTypeLabels[type], href: `/properties?purpose=${purpose}&category=${category.value}&type=${type}` })) }));
}

const menus = [
  { label:"Home", href:"/" }, { label:"About Us", href:"/about" },
  { label:"Properties for Sale", href:"/properties?purpose=sale", groups:propertyGroups("sale") },
  { label:"Properties for Rent / Lease", href:"/properties?purpose=rent", groups:propertyGroups("rent") },
  { label:"Paying Guest", href:"/paying-guest", groups:[{ label:"Accommodation", items:[{label:"Men's PG",href:"/paying-guest?category=mens"},{label:"Women's PG",href:"/paying-guest?category=womens"},{label:"Co-Living",href:"/paying-guest?category=co_living"}] }] },
  { label:"Real Estate Agents", href:"/agents" }, { label:"Advertise With Us", href:"/advertise-with-us" }, { label:"Contact Us", href:"/contact" },
];

export function PublicNavigation() {
  const [open,setOpen] = useState(false);
  useEffect(() => { document.body.classList.toggle("menu-open", open); return () => document.body.classList.remove("menu-open"); }, [open]);
  useEffect(() => { const close=(event:KeyboardEvent)=>event.key==="Escape"&&setOpen(false); document.addEventListener("keydown",close); return()=>document.removeEventListener("keydown",close); },[]);
  return <>
    <nav className="desktop-nav" aria-label="Primary navigation">{menus.map((item) => item.groups ? <details className="nav-dropdown" key={item.label}><summary>{item.label}<ChevronDown size={14} aria-hidden="true" /></summary><div className="mega-menu"><Link className="mega-all" href={item.href}>View all {item.label.toLowerCase()}</Link>{item.groups.map((group)=><section key={group.label}><h3>{group.label}</h3>{group.items.map((child)=><Link key={child.href} href={child.href}>{child.label}</Link>)}</section>)}</div></details> : <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
    <button className="menu-toggle" type="button" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen((value)=>!value)}>{open?<X/>:<Menu/>}</button>
    <div className={`mobile-nav-backdrop ${open?"is-open":""}`} onClick={()=>setOpen(false)} aria-hidden="true" />
    <nav id="mobile-navigation" className={`mobile-nav ${open?"is-open":""}`} aria-label="Mobile navigation" aria-hidden={!open} onClick={(event)=>{if((event.target as HTMLElement).closest("a"))setOpen(false)}}>{menus.map((item)=>item.groups?<details key={item.label}><summary>{item.label}<ChevronDown size={16}/></summary><Link className="mobile-all" href={item.href}>View all</Link>{item.groups.map((group)=><div className="mobile-group" key={group.label}><strong>{group.label}</strong>{group.items.map((child)=><Link key={child.href} href={child.href}>{child.label}</Link>)}</div>)}</details>:<Link key={item.href} href={item.href}>{item.label}</Link>)}<div className="mobile-nav-actions"><Link href="/login">Sign in</Link><Link className="button" href="/post-property">Post property</Link></div></nav>
  </>;
}
