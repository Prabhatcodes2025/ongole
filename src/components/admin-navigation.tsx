import Link from "next/link";
const links=[["/admin","Overview"],["/admin/properties","Properties"],["/admin/enquiries","CRM"],["/admin/advertisements","Advertisements"],["/admin/masters","Master data"],["/admin/reports","Reports"],["/admin/audit","Audit logs"]] as const;
export function AdminNavigation(){return <nav className="admin-navigation" aria-label="Administration">{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>}
