import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/src/components/enquiry-form";
import { siteConfig } from "@/src/config/site";

export function ContactPage() {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Contact Us", item: `${siteConfig.url}/contact` },
    ],
  };

  return <main id="main" className="contact-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
    <section className="inner-hero editorial"><div className="shell"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><b>›</b><span>Contact Us</span></nav><p className="eyebrow">Contact &amp; support</p><h1>Talk to a local property professional</h1><p>Our digital platform accepts enquiries 24 hours a day, seven days a week. The team responds at the earliest practical opportunity.</p></div></section>
    <section className="section shell contact-layout"><div><div className="contact-card-grid"><a href={siteConfig.phoneHref}><Phone aria-hidden="true"/><span><strong>Voice Call</strong>{siteConfig.phone}</span></a><a href={siteConfig.whatsappHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true"/><span><strong>WhatsApp</strong>{siteConfig.whatsapp}</span></a><a href={`mailto:${siteConfig.email}`}><Mail aria-hidden="true"/><span><strong>General Enquiry</strong>{siteConfig.email}</span></a><a href={`mailto:${siteConfig.salesEmail}`}><Mail aria-hidden="true"/><span><strong>Sales &amp; Advertising</strong>{siteConfig.salesEmail}</span></a><a href={`mailto:${siteConfig.nriEmail}`}><Mail aria-hidden="true"/><span><strong>NRI Services</strong>{siteConfig.nriEmail}</span></a></div><article className="contact-office"><MapPin aria-hidden="true"/><div><p className="eyebrow">Office</p><h2>Ongole, Andhra Pradesh</h2><p>{siteConfig.address}</p><a className="arrow-link" href="https://www.google.com/maps/search/?api=1&query=4th%20Lane%2C%20Bhagya%20Nagar%2C%20Ongole%2C%20Andhra%20Pradesh" target="_blank" rel="noreferrer">Open location in Google Maps →</a></div></article></div><section className="contact-form-card" aria-labelledby="contact-form-heading"><p className="eyebrow">Send an enquiry</p><h2 id="contact-form-heading">How can we help?</h2><p>Share your property, service or support requirement. Required fields are marked and your enquiry will receive a reference number.</p><EnquiryForm defaultMessage="I would like to know more about OngoleProperty.com services." captchaSiteKey={process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY}/></section></section>
  </main>;
}
