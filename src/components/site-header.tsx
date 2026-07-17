import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Linkedin, Mail, Phone } from "lucide-react";
import { PublicNavigation } from "@/src/components/public-navigation";
import { siteConfig } from "@/src/config/site";

const socials = [
  { label: "Facebook", href: siteConfig.social.facebook, Icon: Facebook },
  { label: "Instagram", href: siteConfig.social.instagram, Icon: Instagram },
  { label: "LinkedIn", href: siteConfig.social.linkedin, Icon: Linkedin },
];

export function SiteHeader() {
  return <header className="site-header">
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="utility-bar"><div className="shell utility-inner"><span>Serving Ongole &amp; Prakasam District since 2002</span><div className="utility-links"><a href={siteConfig.phoneHref}><Phone aria-hidden="true" size={14} />{siteConfig.phone}</a><a href={`mailto:${siteConfig.email}`}><Mail aria-hidden="true" size={14} />{siteConfig.email}</a><span className="social-links" aria-label="Social media">{socials.map(({ label, href, Icon }) => href ? <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><Icon size={14} /></a> : <span key={label} title={`${label} link not configured`} aria-label={`${label} link not configured`}><Icon size={14} /></span>)}</span></div></div></div>
    <div className="shell nav-row">
      <Link className="brand" href="/" aria-label="OngoleProperty.com home"><Image src="/ongole-property-logo.png" width={54} height={54} alt="OngoleProperty.com" priority /><span><strong>OngoleProperty</strong><small>Trusted since 2002</small></span></Link>
      <PublicNavigation />
      <div className="nav-actions"><Link className="text-link" href="/login">Sign in</Link><Link className="button button-small" href="/post-property">Post property</Link></div>
    </div>
  </header>;
}
