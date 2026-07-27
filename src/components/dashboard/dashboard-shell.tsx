import type {ReactNode} from "react";
import Link from "next/link";
import {Bell,Building2,ChartNoAxesCombined,CreditCard,FileText,Home,HousePlus,LayoutDashboard,LogOut,Megaphone,Search,Users} from "lucide-react";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

type NavItem={href:string;label:string;permission?:string;icon?:ReactNode};
const ownerNav:NavItem[]=[
  {href:"/dashboard",label:"Overview",icon:<LayoutDashboard/>},{href:"/dashboard/properties",label:"Properties",icon:<Home/>},
  {href:"/dashboard/pg",label:"Paying Guest",icon:<Building2/>},{href:"/dashboard/enquiries",label:"Enquiries",icon:<Users/>},
  {href:"/dashboard/analytics",label:"Analytics",icon:<ChartNoAxesCombined/>},{href:"/dashboard/billing",label:"Billing & Plan",icon:<CreditCard/>},
  {href:"/dashboard/promotions",label:"Promotions",icon:<Megaphone/>},
];
const adminNav:NavItem[]=[
  {href:"/admin",label:"Overview",icon:<LayoutDashboard/>},{href:"/admin/properties",label:"Properties",permission:"properties.read",icon:<Home/>},
  {href:"/admin/pg",label:"Paying Guest",permission:"pg.read",icon:<Building2/>},{href:"/admin/enquiries",label:"Enquiries",permission:"enquiries.read",icon:<Users/>},
  {href:"/admin/billing",label:"Billing",permission:"subscriptions.read",icon:<CreditCard/>},{href:"/admin/promotions",label:"Promotions",permission:"promotions.read",icon:<Megaphone/>},
  {href:"/admin/analytics",label:"Analytics",permission:"analytics.read",icon:<ChartNoAxesCombined/>},{href:"/admin/reports",label:"Reports",permission:"reports.read",icon:<FileText/>},
];

export async function DashboardShell({children,title,description,actions,variant="owner",breadcrumbs=[]}:{children:ReactNode;title:string;description?:string;actions?:ReactNode;variant?:"owner"|"admin";breadcrumbs?:{label:string;href?:string}[]}){
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  const [{data:profile},{data:context},{data:notifications,count}]=await Promise.all([
    auth.user?supabase.from("profiles").select("full_name,email,account_type").eq("id",auth.user.id).maybeSingle():Promise.resolve({data:null,error:null,count:null,status:200,statusText:"OK"}),
    supabase.rpc("get_current_auth_context"),supabase.from("notifications").select("id,title,body,action_url,read_at,created_at",{count:"exact"}).is("read_at",null).order("created_at",{ascending:false}).limit(8)
  ]);
  const permissions=Array.isArray((context as {permissions?:unknown}|null)?.permissions)?(context as {permissions:string[]}).permissions:[];
  const nav=(variant==="admin"?adminNav:ownerNav).filter((item)=>!item.permission||permissions.includes(item.permission));
  return <main id="main" className={`dashboard-app dashboard-${variant}`}><aside className="dashboard-sidebar"><Link className="dashboard-brand" href="/"><span>OP</span><strong>OngoleProperty<small>{variant==="admin"?"Administration":"Owner workspace"}</small></strong></Link><DashboardSidebar items={nav}/><div className="sidebar-footer"><Link href="/">Public website</Link><form action="/api/auth/logout" method="post"><button><LogOut/>Sign out</button></form></div></aside><div className="dashboard-workspace"><DashboardHeader name={profile?.full_name||profile?.email||auth.user?.email||"Account"} count={count||0} notifications={notifications||[]} nav={nav}/><div className="dashboard-content">{breadcrumbs.length>0&&<nav className="dashboard-breadcrumbs">{breadcrumbs.map((item,index)=><span key={item.label}>{index>0&&<b>/</b>}{item.href?<Link href={item.href}>{item.label}</Link>:item.label}</span>)}</nav>}<div className="dashboard-page-title"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="dashboard-title-actions">{actions}</div>}</div>{children}</div></div></main>;
}

export function DashboardSidebar({items}:{items:NavItem[]}){return <nav className="dashboard-nav" aria-label="Dashboard">{items.map((item)=><Link key={item.href} href={item.href}>{item.icon}<span>{item.label}</span></Link>)}</nav>}

export function DashboardHeader({name,count,notifications,nav}:{name:string;count:number;notifications:{id:string;title:string;body:string;action_url:string|null;created_at:string}[];nav:NavItem[]}){
  return <header className="dashboard-header"><details className="dashboard-mobile-menu"><summary>Menu</summary><DashboardSidebar items={nav}/></details><form className="dashboard-search" action="/properties"><Search/><input name="q" aria-label="Search listings" placeholder="Search listings…"/></form><div className="dashboard-header-actions"><NotificationDropdown count={count} items={notifications}/><details className="profile-menu"><summary><span>{name.slice(0,1).toUpperCase()}</span><b>{name}</b></summary><div><Link href="/dashboard/profile">Edit profile</Link><form action="/api/auth/logout" method="post"><button>Sign out</button></form></div></details></div></header>;
}

export function NotificationDropdown({count,items}:{count:number;items:{id:string;title:string;body:string;action_url:string|null;created_at:string}[]}){
  return <details className="notification-dropdown"><summary aria-label={`${count} unread notifications`}><Bell/><span>{count>99?"99+":count}</span></summary><div className="notification-panel"><div><strong>Notifications</strong>{count>0&&<form action="/api/notifications/read" method="post"><input type="hidden" name="action" value="all"/><button>Mark all read</button></form>}</div>{items.length?<ul>{items.map((item)=><li key={item.id}><Link href={item.action_url||"/dashboard/notifications"}><strong>{item.title}</strong><p>{item.body}</p><time>{new Date(item.created_at).toLocaleDateString("en-IN")}</time></Link><form action="/api/notifications/read" method="post"><input type="hidden" name="id" value={item.id}/><button aria-label={`Mark ${item.title} read`}>×</button></form></li>)}</ul>:<EmptyState title="All caught up" description="You have no unread notifications."/>}<Link className="notification-all" href="/dashboard/notifications">View all notifications</Link></div></details>;
}

export function StatCard({label,value,change,icon}:{label:string;value:ReactNode;change?:string;icon?:ReactNode}){return <article className="stat-card"><div>{icon}</div><p>{label}</p><strong>{value}</strong>{change&&<small>{change}</small>}</article>}
export function ChartCard({title,description,children}:{title:string;description?:string;children:ReactNode}){return <article className="dashboard-card chart-card"><header><h2>{title}</h2>{description&&<p>{description}</p>}</header>{children}</article>}
export function DataTable({headers,children,caption}:{headers:string[];children:ReactNode;caption:string}){return <div className="data-table-wrap"><table className="data-table"><caption>{caption}</caption><thead><tr>{headers.map((header)=><th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
export function FilterBar({children}:{children:ReactNode}){return <div className="filter-bar">{children}</div>}
export function StatusBadge({status}:{status:string}){return <span className={`dashboard-status dashboard-status-${status}`}>{status.replaceAll("_"," ")}</span>}
export function EmptyState({title,description,action}:{title:string;description:string;action?:ReactNode}){return <div className="dashboard-empty"><HousePlus/><h3>{title}</h3><p>{description}</p>{action}</div>}
export function LoadingSkeleton(){return <div className="dashboard-skeleton" aria-label="Loading"><i/><i/><i/></div>}
export function QuickActionCard({href,title,description,icon}:{href:string;title:string;description:string;icon?:ReactNode}){return <Link className="quick-action-card" href={href}>{icon}<span><strong>{title}</strong><small>{description}</small></span></Link>}
export function ActivityTimeline({items}:{items:{id:string|number;title:string;detail?:string;createdAt:string}[]}){return items.length?<ol className="dashboard-timeline">{items.map((item)=><li key={item.id}><i/><div><strong>{item.title}</strong>{item.detail&&<p>{item.detail}</p>}<time>{new Date(item.createdAt).toLocaleString("en-IN")}</time></div></li>)}</ol>:<EmptyState title="No recent activity" description="New listing and billing events will appear here."/>}
export function PlanUsageCard({plan,used,limit,label,href="/dashboard/billing"}:{plan:string;used:number;limit:number;label:string;href?:string}){const percentage=limit?Math.min(100,Math.round(used/limit*100)):0;return <article className="dashboard-card plan-usage-card"><header><div><p>Current plan</p><h2>{plan}</h2></div><Link href={href}>Manage</Link></header><div className="usage-row"><span>{label}</span><b>{used} / {limit}</b></div><div className="usage-track"><i style={{width:`${percentage}%`}}/></div>{used>=limit&&<p className="usage-warning">Limit reached. Upgrade to add more.</p>}</article>}
