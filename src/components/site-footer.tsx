import Link from "next/link";
import { siteConfig } from "@/src/config/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand"><p className="eyebrow">Kosana Associates LLP</p><h2>Local knowledge. Professional property marketing.</h2><p>{siteConfig.description}</p></div>
        <div><h3>Explore</h3><Link href="/properties">All properties</Link><Link href="/paying-guest">Paying guest</Link><Link href="/agents">Agent network</Link><Link href="/services">Services</Link></div>
        <div><h3>Company</h3><Link href="/about">About us</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
        <div><h3>Contact</h3><a href={siteConfig.phoneHref}>{siteConfig.phone}</a><a href={siteConfig.whatsappHref}>{siteConfig.whatsapp}</a><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a><p>{siteConfig.address}</p></div>
      </div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} OngoleProperty.com</span><span>Open 24 hours · 7 days a week</span></div>
    </footer>
  );
}
