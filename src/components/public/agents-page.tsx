import Link from "next/link";
import { BadgeCheck, ClipboardCheck, Search, Send, UserCheck } from "lucide-react";
import { siteConfig } from "@/src/config/site";

const steps = [
  [Send, "Register", "Create an account and submit your professional profile."],
  [ClipboardCheck, "Pending review", "The application remains private while the information is reviewed."],
  [UserCheck, "Administrator decision", "An authorised administrator approves or rejects the application."],
  [Search, "Public eligibility", "Only verified, active profiles become eligible for public discovery."],
] as const;

export function AgentsPage() {
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:siteConfig.url},{"@type":"ListItem",position:2,name:"Real Estate Agents",item:`${siteConfig.url}/agents`} ]};
  return <main id="main" className="agents-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(breadcrumb).replace(/</g,"\\u003c")}}/><section className="inner-hero editorial"><div className="shell"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><b>›</b><span>Real Estate Agents</span></nav><p className="eyebrow">Professional network</p><h1>Join a verified local real estate agent network</h1><p>Real estate professionals can register a profile, declare working towns and specialisations, and enter the review workflow. Registration never publishes a profile automatically.</p><div className="button-row"><Link className="button" href="/register?accountType=agent">Register as Real Estate Agent</Link><Link className="button button-outline" href="/contact">Contact Us</Link></div></div></section><section className="section shell"><div className="section-heading"><div><p className="eyebrow">Review workflow</p><h2>Verification comes before public visibility</h2></div><p>Profiles can include service towns, property specialisations, years of experience, office address and an administrator-reviewed introduction.</p></div><ol className="agent-process">{steps.map(([Icon,title,copy],index)=><li key={title}><span>{index+1}</span><Icon aria-hidden="true"/><h3>{title}</h3><p>{copy}</p></li>)}</ol></section><section className="section section-tinted"><div className="shell agent-standards"><div><BadgeCheck aria-hidden="true"/><p className="eyebrow">Responsible publishing</p><h2>No automatic public profile</h2></div><div><p>Only agents reviewed by an administrator and marked verified and active may appear publicly. OngoleProperty.com does not fabricate ratings, licences, experience, reviews or verification claims.</p><Link className="arrow-link" href="/register?accountType=agent">Start agent registration →</Link></div></div></section></main>;
}
