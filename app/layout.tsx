import type { Metadata } from "next";
import { Geist, Lora } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/src/components/site-header";
import { SiteFooter } from "@/src/components/site-footer";
import { siteConfig } from "@/src/config/site";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: "OngoleProperty.com | Trusted Real Estate Since 2002", template: "%s | OngoleProperty.com" },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "en_IN", siteName: siteConfig.name, title: "OngoleProperty.com", description: siteConfig.description, url: "/" },
  twitter: { card: "summary_large_image", title: siteConfig.name, description: siteConfig.description },
  icons: { icon: "/ongole-property-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body className={`${geist.variable} ${lora.variable}`}><SiteHeader />{children}<SiteFooter /></body></html>;
}
