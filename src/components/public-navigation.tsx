"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BedDouble, ChevronDown, House, KeyRound, Menu, Plane, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const menus = [
  { label: "Sale", href: "/properties-for-sale", Icon: KeyRound },
  { label: "Rent", href: "/properties-for-rent", Icon: House },
  { label: "Paying Guest", href: "/paying-guest", Icon: BedDouble },
  { label: "NRI Services", href: "/nri-services-ongole", Icon: Plane },
  { label: "Real Estate Agents", href: "/agents", Icon: Users },
];
const moreItems = [
  { label: "About Us", href: "/about" },
  { label: "Advertise With Us", href: "/advertise-with-us" },
  { label: "Contact Us", href: "/contact" },
];

export function PublicNavigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const current = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const closeAll = () => { setDesktopMenu(false); setMobileMenu(false); setMobileOpen(false); };

  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileOpen);
    if (mobileOpen) mobileNavRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => document.body.classList.remove("menu-open");
  }, [mobileOpen]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setDesktopMenu(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mobileOpen) { setMobileOpen(false); setMobileMenu(false); toggleRef.current?.focus(); }
        else if (desktopMenu) { setDesktopMenu(false); moreButtonRef.current?.focus(); }
      }
      if (event.key === "Tab" && mobileOpen) {
        const controls = [toggleRef.current, ...Array.from(mobileNavRef.current?.querySelectorAll<HTMLElement>("a,button") || [])].filter((item): item is HTMLElement => Boolean(item));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard); };
  }, [mobileOpen, desktopMenu]);

  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 1100px)");
    const reset = () => { setMobileOpen(false); setMobileMenu(false); setDesktopMenu(false); };
    breakpoint.addEventListener("change", reset);
    return () => breakpoint.removeEventListener("change", reset);
  }, []);

  return <>
    <nav className="desktop-nav" aria-label="Primary navigation">
      {menus.map(({ label, href, Icon }) => <Link key={href} href={href} aria-current={current(href) ? "page" : undefined} onClick={closeAll}><Icon size={16} aria-hidden="true"/>{label}</Link>)}
      <div ref={moreRef} className="nav-more" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDesktopMenu(false); }}>
        <button ref={moreButtonRef} type="button" aria-expanded={desktopMenu} aria-controls="desktop-more" data-active={moreItems.some(({href}) => current(href)) || undefined} onClick={() => setDesktopMenu(!desktopMenu)}>More<ChevronDown size={14} aria-hidden="true"/></button>
        <div id="desktop-more" className="nav-more-menu" hidden={!desktopMenu}>
          {moreItems.map(({ label, href }) => <Link key={href} href={href} aria-current={current(href) ? "page" : undefined} onClick={closeAll}>{label}</Link>)}
        </div>
      </div>
    </nav>
    <button ref={toggleRef} className="menu-toggle" type="button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => { setMobileOpen(!mobileOpen); setMobileMenu(false); }}>{mobileOpen ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}</button>
    <div className={`mobile-nav-backdrop ${mobileOpen ? "is-open" : ""}`} onClick={() => { closeAll(); toggleRef.current?.focus(); }} aria-hidden="true"/>
    <nav ref={mobileNavRef} id="mobile-navigation" className={`mobile-nav ${mobileOpen ? "is-open" : ""}`} aria-label="Mobile navigation" inert={!mobileOpen} aria-hidden={!mobileOpen}>
      {menus.map(({ label, href, Icon }) => <Link key={href} href={href} aria-current={current(href) ? "page" : undefined} onClick={closeAll}><Icon size={18} aria-hidden="true"/>{label}</Link>)}
      <div className="mobile-menu">
        <button type="button" aria-expanded={mobileMenu} aria-controls="mobile-more" onClick={() => setMobileMenu(!mobileMenu)}>More<ChevronDown size={16} aria-hidden="true"/></button>
        {mobileMenu && <div id="mobile-more" className="mobile-more-items">{moreItems.map(({ label, href }) => <Link key={href} href={href} aria-current={current(href) ? "page" : undefined} onClick={closeAll}>{label}</Link>)}</div>}
      </div>
      <div className="mobile-nav-actions"><Link href="/login" onClick={closeAll}>Sign in</Link><Link className="button" href="/post-property" onClick={closeAll}>Post property</Link></div>
    </nav>
  </>;
}
