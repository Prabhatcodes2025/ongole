import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {DashboardShell,StatusBadge} from "@/src/components/dashboard/dashboard-shell";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {getPublicPropertyCatalog} from "@/src/lib/masters/public";
import {PushOptIn} from "@/src/components/property-alerts/push-opt-in";
import type {PropertyCatalogData} from "@/src/config/property-catalog";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My Property Alerts",robots:{index:false,follow:false}};
type Requirement={id:string;transaction_type:string;category_slug:string|null;property_type_slug:string|null;locations:string[];min_budget:number|null;max_budget:number|null;min_area_sq_ft:number|null;max_area_sq_ft:number|null;bedrooms:number|null;active:boolean};
function AlertFields({catalog,item}:{catalog:PropertyCatalogData;item?:Requirement}){
  return <div className="property-alert-fields">
    <label>Transaction<select name="transaction_type" defaultValue={item?.transaction_type||"sale"}><option value="sale">Buy / Sale</option><option value="rent">Rent</option><option value="lease">Lease</option></select></label>
    <label>Category<select name="category_slug" defaultValue={item?.category_slug||""}><option value="">Any category</option>{catalog.categories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
    <label>Property type<select name="property_type_slug" defaultValue={item?.property_type_slug||""}><option value="">Any type</option>{catalog.categories.flatMap(category=>category.types).filter((type,index,all)=>all.findIndex(other=>other.value===type.value)===index).map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
    <label>Preferred locations (up to 5, comma-separated)<input name="locations" list="alert-locations" defaultValue={item?.locations.join(", ")||""} placeholder="Ongole, Bhagyanagar"/></label>
    <label>Minimum budget (₹)<input name="min_budget" type="number" min="0" step="1" defaultValue={item?.min_budget??""}/></label>
    <label>Maximum budget (₹)<input name="max_budget" type="number" min="0" step="1" defaultValue={item?.max_budget??""}/></label>
    <label>Minimum area (sq ft)<input name="min_area_sq_ft" type="number" min="0" step="0.01" defaultValue={item?.min_area_sq_ft??""}/></label>
    <label>Maximum area (sq ft)<input name="max_area_sq_ft" type="number" min="0" step="0.01" defaultValue={item?.max_area_sq_ft??""}/></label>
    <label>BHK (optional)<input name="bedrooms" type="number" min="0" max="20" defaultValue={item?.bedrooms??""}/></label>
  </div>;
}
export default async function PropertyAlertsPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?returnTo=/dashboard/property-alerts");
  const [catalog,prefs,requirements,params]=await Promise.all([getPublicPropertyCatalog(),supabase.from("property_alert_preferences").select("enabled,permission_status").eq("user_id",user.id).maybeSingle(),supabase.from("property_alert_requirements").select("id,transaction_type,category_slug,property_type_slug,locations,min_budget,max_budget,min_area_sq_ft,max_area_sq_ft,bedrooms,active").eq("user_id",user.id).order("created_at",{ascending:false}),searchParams]);
  const items=(requirements.data||[]) as Requirement[];
  return <DashboardShell title="My Property Alerts" description="Save your requirements and receive alerts when a matching listing goes live." breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"My Property Alerts"}]}>
    {params.error&&<p role="alert" className="form-error">{params.error}</p>}
    <PushOptIn enabled={Boolean(prefs.data?.enabled)} status={prefs.data?.permission_status||"default"}/>
    <datalist id="alert-locations">{catalog.locations.map(location=><option key={location} value={location}/>)}</datalist>
    <section className="dashboard-section"><div className="dashboard-section-head"><h2>Saved alerts</h2></div>
      {items.length?<div className="property-alert-list">{items.map(item=><article className="dashboard-card" key={item.id}>
        <div className="dashboard-section-head"><div><h3>{item.transaction_type==="sale"?"Buy":item.transaction_type==="rent"?"Rent":"Lease"} · {catalog.categories.find(category=>category.value===item.category_slug)?.types.find(type=>type.value===item.property_type_slug)?.label||catalog.categories.find(category=>category.value===item.category_slug)?.label||"Any property"}</h3><p>{item.locations.join(", ")||"Any location"}{item.min_budget!==null||item.max_budget!==null?` · ₹${item.min_budget?.toLocaleString("en-IN")||"0"}–${item.max_budget?.toLocaleString("en-IN")||"any"}`:""}</p></div><StatusBadge status={item.active?"active":"paused"}/></div>
        <div className="dashboard-title-actions"><form method="post" action="/api/property-alerts"><input type="hidden" name="id" value={item.id}/><input type="hidden" name="action" value={item.active?"pause":"resume"}/><button className="button button-small">{item.active?"Pause":"Resume"}</button></form><form method="post" action="/api/property-alerts"><input type="hidden" name="id" value={item.id}/><input type="hidden" name="action" value="delete"/><button className="button button-small" type="submit">Delete</button></form></div>
        <details><summary>Edit alert</summary><form method="post" action="/api/property-alerts"><input type="hidden" name="action" value="update"/><input type="hidden" name="id" value={item.id}/><AlertFields catalog={catalog} item={item}/><button className="button">Save changes</button></form></details>
      </article>)}</div>:<p>No saved alerts yet. Add your first requirement below.</p>}
    </section>
    <section className="dashboard-card"><h2>+ Add New Property Alert</h2><form method="post" action="/api/property-alerts"><input type="hidden" name="action" value="create"/><AlertFields catalog={catalog}/><button className="button">Save alert</button></form></section>
  </DashboardShell>;
}
