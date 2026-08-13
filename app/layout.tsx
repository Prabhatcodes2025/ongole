import type { Metadata } from "next";
import { Geist, Lora } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/src/components/site-header";
import { SiteFooter } from "@/src/components/site-footer";
import { siteConfig } from "@/src/config/site";
import { Analytics } from "@/src/components/analytics";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: "OngoleProperty.com | Trusted Real Estate Since 2002", template: "%s | OngoleProperty.com" },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "en_IN", siteName: siteConfig.name, title: "OngoleProperty.com", description: siteConfig.description, url: "/", images:[{url:"/ongole-property-logo.png",width:1024,height:1024,alt:siteConfig.name}] },
  twitter: { card: "summary_large_image", title: siteConfig.name, description: siteConfig.description, images:["/ongole-property-logo.png"] },
  icons: { icon: "/ongole-property-logo.png" },
  verification: { google:process.env.GOOGLE_SITE_VERIFICATION||undefined, other:process.env.BING_SITE_VERIFICATION?{"msvalidate.01":[process.env.BING_SITE_VERIFICATION]}:undefined },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData=[{"@context":"https://schema.org","@type":"Organization",name:siteConfig.name,legalName:siteConfig.legalName,url:siteConfig.url,logo:`${siteConfig.url}/ongole-property-logo.png`,email:siteConfig.email,telephone:siteConfig.phone,areaServed:[{"@type":"City",name:"Ongole"},{"@type":"AdministrativeArea",name:"Prakasam District"}]},{"@context":"https://schema.org","@type":"WebSite",name:siteConfig.name,url:siteConfig.url,potentialAction:{"@type":"SearchAction",target:`${siteConfig.url}/properties?q={search_term_string}`,"query-input":"required name=search_term_string"}}];
  return <html lang="en-IN"><body className={`${geist.variable} ${lora.variable}`}><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}}/><Analytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}/><SiteHeader />{children}<SiteFooter /></body></html>;
}
