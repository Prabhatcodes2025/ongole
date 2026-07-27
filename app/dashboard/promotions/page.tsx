import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {PaymentButton} from "@/src/components/billing/payment-button";
import {PromotionClaimButton} from "@/src/components/billing/promotion-claim-button";
import {DashboardShell,DataTable,EmptyState,StatusBadge} from "@/src/components/dashboard/dashboard-shell";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Listing promotions",robots:{index:false,follow:false}};

export default async function PromotionsPage({searchParams}:{searchParams:Promise<{property?:string}>}){
  const params=await searchParams;
  const supabase=await createSupabaseServerClient();
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/dashboard/promotions");
  const[{data:products},{data:properties},{data:activations}]=await Promise.all([
    supabase.from("promotion_products").select("*").eq("is_active",true).order("display_order"),
    supabase.from("properties").select("id,title,reference_no,details,status").eq("owner_id",auth.user.id).is("deleted_at",null),
    supabase.from("promotion_activations").select("id,starts_at,ends_at,status,property_id,promotion_products(name,promotion_type)").eq("user_id",auth.user.id).order("created_at",{ascending:false}),
  ]);
  const selected=properties?.find((item)=>item.id===params.property)||properties?.[0];
  const eligibleType=selected?.details?.listing_kind==="paying_guest"?"pg":"property";
  return <DashboardShell title="Promotions" description="Increase visibility with time-bound, auditable activation records." breadcrumbs={[{label:"Dashboard",href:"/dashboard"},{label:"Promotions"}]}>
    <form className="filter-bar">
      <label>Listing <select name="property" defaultValue={selected?.id}>{properties?.map((item)=><option value={item.id} key={item.id}>{item.title} ({item.reference_no})</option>)}</select></label>
      <button className="button button-small">Select</button>
    </form>
    {selected?<><section className="dashboard-card">
      <h2>Included with your plan</h2>
      <p>Use an available plan allowance without starting a payment.</p>
      <div className="dashboard-title-actions"><PromotionClaimButton propertyId={selected.id} promotionType="featured"/><PromotionClaimButton propertyId={selected.id} promotionType="verified"/></div>
    </section>
    <div className="promotion-grid">{products?.filter((product)=>product.eligible_listing_type==="both"||product.eligible_listing_type===eligibleType).map((product)=><article className="dashboard-card" key={product.id}>
      <p className="eyebrow">{product.placement}</p><h2>{product.name}</h2>
      <p>{product.duration_days} days · {product.promotion_type.replaceAll("_"," ")}</p>
      <strong>₹{Number(product.price).toLocaleString("en-IN")}</strong>
      <PaymentButton productId={product.id} propertyId={selected.id} label="Purchase"/>
    </article>)}</div></>:<EmptyState title="No eligible listings" description="Create a listing before purchasing a promotion."/>}
    <section className="dashboard-section"><div className="dashboard-section-head"><h2>Activation history</h2></div>
      {activations?.length?<DataTable caption="Promotion activations" headers={["Promotion","Listing","Starts","Ends","Status"]}>{activations.map((item)=>{
        const product=Array.isArray(item.promotion_products)?item.promotion_products[0]:item.promotion_products;
        return <tr key={item.id}><td>{product?.name}</td><td>{properties?.find((property)=>property.id===item.property_id)?.title}</td><td>{new Date(item.starts_at).toLocaleDateString("en-IN")}</td><td>{new Date(item.ends_at).toLocaleDateString("en-IN")}</td><td><StatusBadge status={item.status}/></td></tr>
      })}</DataTable>:<EmptyState title="No promotions" description="Purchased or included activations appear here."/>}
    </section>
  </DashboardShell>;
}
