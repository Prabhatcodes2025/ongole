"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { propertyCategories, propertyTypeLabels } from "@/src/config/property-catalog";

function propertyGroups(purpose:"sale"|"rent"){const base=purpose==="sale"?"/properties-for-sale":"/properties-for-rent";return propertyCategories.map((category)=>({label:category.label,items:category.types.map((type)=>({label:propertyTypeLabels[type],href:`${base}?category=${category.value}&type=${type}`}))}))}
const menus=[{label:"Home",href:"/"},{label:"About Us",href:"/about"},{label:"Properties for Sale",href:"/properties-for-sale",groups:propertyGroups("sale")},{label:"Properties for Rent / Lease",href:"/properties-for-rent",groups:propertyGroups("rent")},{label:"Paying Guest",href:"/paying-guest",groups:[{label:"Accommodation",items:[{label:"Men's PG",href:"/paying-guest?gender=mens"},{label:"Women's PG",href:"/paying-guest?gender=womens"},{label:"Co-Living",href:"/paying-guest?gender=co_living"}]}]},{label:"NRI Services",href:"/nri-services-ongole"},{label:"Real Estate Agents",href:"/agents"},{label:"Advertise With Us",href:"/advertise-with-us"},{label:"Contact Us",href:"/contact"}];

export function PublicNavigation(){
  const pathname=usePathname();const [mobileOpen,setMobileOpen]=useState(false),[desktopMenu,setDesktopMenu]=useState<string|null>(null),[mobileMenu,setMobileMenu]=useState<string|null>(null);const leaveTimer=useRef<number|null>(null),toggleRef=useRef<HTMLButtonElement|null>(null),mobileNavRef=useRef<HTMLElement|null>(null);const current=(href:string)=>!href.includes("?")&&pathname===href;
  const closeAll=()=>{setDesktopMenu(null);setMobileMenu(null);setMobileOpen(false)};
  useEffect(()=>{document.body.classList.toggle("menu-open",mobileOpen);return()=>document.body.classList.remove("menu-open")},[mobileOpen]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape"&&mobileOpen){closeAll();toggleRef.current?.focus()}else if(event.key==="Escape")setDesktopMenu(null)};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[mobileOpen]);
  const enter=(label:string)=>{if(leaveTimer.current)window.clearTimeout(leaveTimer.current);setDesktopMenu(label)};
  const leave=()=>{leaveTimer.current=window.setTimeout(()=>setDesktopMenu(null),120)};
  const toggleMobile=()=>{const next=!mobileOpen;setMobileOpen(next);if(next)window.setTimeout(()=>mobileNavRef.current?.focus(),260)};
  return <>
    <nav className="desktop-nav" aria-label="Primary navigation">{menus.map((item)=>item.groups?<div className={`nav-dropdown ${desktopMenu===item.label?"is-open":""}`} key={item.label} onMouseEnter={()=>enter(item.label)} onMouseLeave={leave}><button type="button" aria-expanded={desktopMenu===item.label} aria-haspopup="true" onClick={()=>setDesktopMenu((value)=>value===item.label?null:item.label)}>{item.label}<ChevronDown size={14} aria-hidden="true"/></button><div className="mega-menu" hidden={desktopMenu!==item.label} onKeyDown={(event)=>event.key==="Escape"&&setDesktopMenu(null)}><Link className="mega-all" href={item.href} onClick={closeAll}>View all {item.label.toLowerCase()}</Link>{item.groups.map((group)=><section key={group.label}><h3>{group.label}</h3>{group.items.map((child)=><Link key={child.href} href={child.href} onClick={closeAll}>{child.label}</Link>)}</section>)}</div></div>:<Link key={item.href} href={item.href} aria-current={current(item.href)?"page":undefined} onClick={closeAll}>{item.label}</Link>)}</nav>
    <button ref={toggleRef} className="menu-toggle" type="button" aria-label={mobileOpen?"Close navigation":"Open navigation"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={toggleMobile}>{mobileOpen?<X/>:<Menu/>}</button>
    <div className={`mobile-nav-backdrop ${mobileOpen?"is-open":""}`} onClick={closeAll} aria-hidden="true"/>
    <nav ref={mobileNavRef} tabIndex={-1} id="mobile-navigation" className={`mobile-nav ${mobileOpen?"is-open":""}`} aria-label="Mobile navigation" aria-hidden={!mobileOpen}>{menus.map((item)=>item.groups?<div className="mobile-menu" key={item.label}><button type="button" aria-expanded={mobileMenu===item.label} onClick={()=>setMobileMenu((value)=>value===item.label?null:item.label)}>{item.label}<ChevronDown size={16}/></button>{mobileMenu===item.label&&<div><Link className="mobile-all" href={item.href} onClick={closeAll}>View all</Link>{item.groups.map((group)=><div className="mobile-group" key={group.label}><strong>{group.label}</strong>{group.items.map((child)=><Link key={child.href} href={child.href} onClick={closeAll}>{child.label}</Link>)}</div>)}</div>}</div>:<Link key={item.href} href={item.href} aria-current={current(item.href)?"page":undefined} onClick={closeAll}>{item.label}</Link>)}<div className="mobile-nav-actions"><Link href="/login" onClick={closeAll}>Sign in</Link><Link className="button" href="/post-property" onClick={closeAll}>Post property</Link></div></nav>
  </>;
}
