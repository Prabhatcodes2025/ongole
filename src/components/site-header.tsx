import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/src/config/site";

const nav = [["Buy", "/properties?purpose=sale"], ["Rent", "/properties?purpose=rent"], ["Commercial", "/properties?category=commercial"], ["Agricultural", "/properties?category=agricultural"], ["Paying Guest", "/paying-guest"], ["Agents", "/agents"]] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="utility-bar"><div className="shell utility-inner"><span>Serving Ongole &amp; Prakasam District since 2002</span><div><a href={siteConfig.phoneHref}>Call {siteConfig.phone}</a><a href={siteConfig.whatsappHref}>WhatsApp</a><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></div></div></div>
      <div className="shell nav-row">
        <Link className="brand" href="/" aria-label="OngoleProperty.com home"><Image src="/ongole-property-logo.png" width={54} height={54} alt="" priority /><span><strong>OngoleProperty</strong><small>Trusted since 2002</small></span></Link>
        <nav aria-label="Primary navigation">{nav.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</nav>
        <div className="nav-actions"><Link className="text-link" href="/login">Sign in</Link><Link className="button button-small" href="/post-property">Post property</Link></div>
      </div>
    </header>
  );
}
