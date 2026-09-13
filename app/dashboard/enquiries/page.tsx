import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {DashboardShell,DataTable,EmptyState,StatusBadge} from "@/src/components/dashboard/dashboard-shell";
import {getDashboardAuth} from "@/src/lib/dashboard/context";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Listing enquiries",robots:{index:false,follow:false}};

type Summary={total?:number;locations?:Array<{location?:string;count?:number}>};

export default async function OwnerEnquiries(){
  const{supabase,user}=await getDashboardAuth();if(!user)redirect("/login?returnTo=/dashboard/enquiries");
  const[{data:paid},{data:admin}]=await Promise.all([
    supabase.rpc("has_my_paid_enquiry_access"),
    supabase.rpc("has_permission",{required_permission:"enquiries.read"}),
  ]);
  if(paid!==true&&admin!==true){
    const{data,error}=await supabase.rpc("get_my_enquiry_summary");
    if(error)return <DashboardShell title="Enquiries" description="Interest received across your property and PG listings."><p className="form-message error" role="alert">Enquiry totals are temporarily unavailable. Please try again.</p></DashboardShell>;
    const summary=data as Summary|null,total=Number(summary?.total||0),locations=Array.isArray(summary?.locations)?summary.locations:[];
    return <DashboardShell title="Enquiries" description="Interest received across your property and PG listings." breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Enquiries"}]}><section className="dashboard-card"><h2>Total enquiries</h2><p>{total}</p></section><section className="dashboard-card"><h2>Enquiries by location</h2>{locations.length?<DataTable caption="Enquiries by listing location" headers={["Location","Enquiries"]}>{locations.map((item,index)=><tr key={`${item.location||"location"}-${index}`}><td>{item.location||"Location not specified"}</td><td>{Number(item.count||0)}</td></tr>)}</DataTable>:<p>No enquiries yet.</p>}</section><p className="form-note">Enquirer details require an eligible membership. <Link href="/dashboard/billing">See membership options</Link>.</p></DashboardShell>;
  }
  const{data:properties}=await supabase.from("properties").select("id,title").eq("owner_id",user.id);
  const ids=(properties||[]).map((item)=>item.id);
  const{data:items}=ids.length?await supabase.from("enquiries").select("id,reference_no,name,mobile,email,message,status,created_at,property_id").in("property_id",ids).order("created_at",{ascending:false}):{data:[]};
  const titles=new Map((properties||[]).map((item)=>[item.id,item.title]));
  return <DashboardShell title="Enquiries" description="Interest received across your property and PG listings." breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Enquiries"}]}>{items?.length?<DataTable caption="Owner enquiries" headers={["Reference","Listing","Customer","Contact","Message","Status","Received"]}>{items.map((item)=><tr key={item.id}><td>{item.reference_no}</td><td>{titles.get(item.property_id)||"Listing"}</td><td>{item.name}</td><td>{item.mobile}<br/><small>{item.email}</small></td><td className="table-wrap-text">{item.message}</td><td><StatusBadge status={item.status}/></td><td>{new Date(item.created_at).toLocaleDateString("en-IN")}</td></tr>)}</DataTable>:<EmptyState title="No enquiries" description="New enquiries for your published listings will appear here."/>}</DashboardShell>;
}
