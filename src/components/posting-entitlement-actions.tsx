import Link from "next/link";

export function PostingEntitlementActions(){
  return <div className="button-row entitlement-actions">
    <a className="button" href="tel:+917788998459">Contact admin</a>
    <Link className="button button-light" href="/dashboard">Go to Dashboard</Link>
    <Link className="button button-outline" href="/">Back to Home</Link>
  </div>;
}
