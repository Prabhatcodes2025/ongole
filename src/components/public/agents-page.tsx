import Link from "next/link";
import {BadgeCheck,ClipboardCheck,Send,UserCheck} from "lucide-react";
import {siteConfig} from "@/src/config/site";
import {AgentApplicationPrefill} from "@/src/components/agent-application-prefill";

const steps=[[Send,"Prepare application","Enter safe professional details before creating an account."],[ClipboardCheck,"Pending review","The application remains private while the information is reviewed."],[UserCheck,"Administrator decision","An authorised administrator approves or rejects the application."]] as const;

export function AgentsPage(){
  const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:siteConfig.url},{"@type":"ListItem",position:2,name:"Real Estate Agents",item:`${siteConfig.url}/agents`} ]};
  return <main id="main" className="agents-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(breadcrumb).replace(/</g,"\\u003c")}}/>
    <section className="inner-hero editorial"><div className="shell"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><b>›</b><span>Real Estate Agents</span></nav><p className="eyebrow">Professional network</p><h1>Join Ongole &amp; Prakasam&apos;s <span>Verified Agent Network.</span> Faster Deals.</h1><p>Real estate professionals can prepare a private application, then authenticate at the final account-required step. Registration never publishes a profile automatically.</p><p className="agent-telugu-tagline" lang="te">అవకాశాలు — — పంచుకుందాం అనుబంధాలు పెంచుకుందాం కలిసి ఎదుగుదాం.</p><div className="button-row"><a className="button" href="#agent-application">Start Agent Application</a><Link className="button button-outline" href="/contact">Contact Us</Link></div></div></section>
    <section className="section shell"><div className="section-heading"><div><p className="eyebrow">Review workflow</p><h2>Verified Agents. Private Network. Faster Deals.</h2></div><p>Profiles can include service towns, property specialisations, years of experience, office address and an administrator-reviewed introduction.</p></div><ol className="agent-process">{steps.map(([Icon,title,copy],index)=><li key={title}><span>{index+1}</span><Icon aria-hidden="true"/><h3>{title}</h3><p>{copy}</p></li>)}</ol></section>
    <section className="section shell" id="agent-application"><div className="section-heading"><div><p className="eyebrow">Application first</p><h2>Tell us about your work</h2></div><p>These details stay in this browser until you sign in or register at the final step.</p></div><AgentApplicationPrefill/></section>
    <section className="section section-tinted"><div className="shell agent-standards"><div><BadgeCheck aria-hidden="true"/><p className="eyebrow">Responsible network</p><h2>No automatic public profile</h2></div><div><p>Agent applications and review decisions remain private. OngoleProperty.com does not fabricate ratings, licences, experience, reviews or verification claims.</p><a className="arrow-link" href="#agent-application">Start agent registration →</a></div></div></section>
  </main>;
}
