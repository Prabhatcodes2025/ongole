"use client";

import {useEffect,useRef} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";

export function AccountMenu({name,role,className="profile-menu",showDashboard=false}:{name:string;role?:string;className?:string;showDashboard?:boolean}){
  const ref=useRef<HTMLDetailsElement>(null),pathname=usePathname();
  useEffect(()=>{ref.current?.removeAttribute("open")},[pathname]);
  useEffect(()=>{const outside=(event:PointerEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))ref.current.removeAttribute("open")},escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){ref.current?.removeAttribute("open");ref.current?.querySelector("summary")?.focus()}};document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape)}},[]);
  const close=()=>ref.current?.removeAttribute("open");
  return <details ref={ref} className={className}><summary aria-label="Open account menu"><span>{name.slice(0,1).toUpperCase()}</span><b>{name}{role&&<small>{role}</small>}</b></summary><div>{showDashboard&&<Link onClick={close} href="/dashboard">Dashboard</Link>}<Link onClick={close} href="/dashboard/profile">Edit profile</Link><form action="/api/auth/logout" method="post"><button onClick={close}>Sign out</button></form></div></details>;
}
