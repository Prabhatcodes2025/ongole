"use client";

import {MessageCircle,Radio} from "lucide-react";
import {usePathname} from "next/navigation";
import {siteConfig} from "@/src/config/site";

const PRIVATE_PREFIXES=["/admin","/dashboard","/auth","/login","/register","/forgot-password","/reset-password","/update-password"];

export function FloatingWhatsAppControls(){
  const pathname=usePathname();
  if(PRIVATE_PREFIXES.some(prefix=>pathname===prefix||pathname.startsWith(`${prefix}/`)))return null;
  return <nav className="floating-whatsapp-controls" aria-label="WhatsApp links">
    <a href={siteConfig.whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="Chat with OngoleProperty.com on WhatsApp"><MessageCircle aria-hidden="true"/><span>WhatsApp Chat</span></a>
    <a href="https://whatsapp.com/channel/0029Vb9rysWEawdmFYkYMO43" target="_blank" rel="noopener noreferrer" aria-label="Open the OngoleProperty.com WhatsApp Channel"><Radio aria-hidden="true"/><span>WhatsApp Channel</span></a>
  </nav>;
}
