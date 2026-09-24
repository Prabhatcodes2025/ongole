import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Linkedin, Mail, Phone } from "lucide-react";
import { PublicNavigation } from "@/src/components/public-navigation";
import { siteConfig } from "@/src/config/site";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {env} from "@/src/lib/env";

const socials = [
  { label: "Facebook", href: siteConfig.social.facebook, Icon: Facebook },
  { label: "Instagram", href: siteConfig.social.instagram, Icon: Instagram },
  { label: "LinkedIn", href: siteConfig.social.linkedin, Icon: Linkedin },
];

export async function SiteHeader() {
  let account:{name:string}|null=null;
  if(env.isSupabaseConfigured){const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(auth.user){const{data:profile}=await supabase.from("profiles").select("full_name").eq("id",auth.user.id).maybeSingle();account={name:profile?.full_name||auth.user.email?.split("@")[0]||"Account"}}}
  return <header className="site-header">
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="utility-bar"><div className="shell utility-inner"><span>Serving Ongole &amp; Prakasam District since 2002</span><div className="utility-links"><a href={siteConfig.phoneHref}><Phone aria-hidden="true" size={14} />{siteConfig.phone}</a><a href={`mailto:${siteConfig.email}`}><Mail aria-hidden="true" size={14} />{siteConfig.email}</a><span className="social-links" aria-label="Social media">{socials.map(({ label, href, Icon }) => href ? <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><Icon size={14} /></a> : <span key={label} title={`${label} link not configured`} aria-label={`${label} link not configured`}><Icon size={14} /></span>)}</span></div></div></div>
    <div className="shell nav-row">
      <Link className="brand" href="/" aria-label="OngoleProperty.com home"><Image src="/ongole-property-logo.png" width={54} height={54} alt="OngoleProperty.com" priority /><span><strong>OngoleProperty</strong><small>Trusted since 2002</small></span></Link>
      <PublicNavigation account={account} />
      <div className="nav-actions">{account?<details className="public-profile-menu"><summary aria-label="Open account menu"><span>{account.name.slice(0,1).toUpperCase()}</span><b>{account.name}</b></summary><div><Link href="/dashboard">Dashboard</Link><Link href="/dashboard/profile">Edit Profile</Link><form action="/api/auth/logout" method="post"><button>Sign out</button></form></div></details>:<><Link className="text-link" href="/login">Sign in</Link><Link className="button button-small" href="/post-property">Post property</Link></>}</div>
    </div>
  </header>;
}
