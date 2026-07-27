import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {PG_AMENITIES} from "@/src/types/pg";

export const metadata:Metadata={title:"Create PG listing",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";

export default async function NewPgPage(){
  const supabase=await createSupabaseServerClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?returnTo=/dashboard/pg/new");
  return <main id="main" className="portal-page"><div className="shell narrow-shell">
    <nav className="breadcrumbs"><Link href="/dashboard/pg">PG dashboard</Link><span>›</span><span>New listing</span></nav>
    <div className="portal-title"><div><p className="eyebrow">New paying guest listing</p><h1>Create a PG draft</h1><p>You can add rooms and images after saving the draft.</p></div></div>
    <section className="portal-section"><PgForm/></section>
  </div></main>;
}

export function PgForm({defaults}:{defaults?:Record<string,unknown>}){
  const amenities=Array.isArray(defaults?.amenities)?defaults.amenities as string[]:[];
  return <form className="submission-form compact-form" action={defaults?.id?`/api/pg/${defaults.id}`:"/api/pg"} method="post">
    {Boolean(defaults?.id)&&<input type="hidden" name="action" value="update"/>}
    <label className="wide">PG name<input required name="pg_name" minLength={3} maxLength={120} defaultValue={String(defaults?.pg_name||"")}/></label>
    <label>Category<select required name="category" defaultValue={String(defaults?.category||"co_living")}><option value="mens">Boys</option><option value="womens">Girls</option><option value="co_living">Co-living</option><option value="family">Family</option></select></label>
    <label>Starting rent per bed<input required type="number" name="rent_per_bed" min="0" step="1" defaultValue={String(defaults?.rent_per_bed||0)}/></label>
    <label className="wide">Description<textarea name="description" minLength={40} rows={6} defaultValue={String(defaults?.description||"")}/></label>
    <label className="wide">Street address<textarea name="address_line" rows={3} defaultValue={String(defaults?.address_line||"")}/></label>
    <label>Locality<input required name="locality" defaultValue={String(defaults?.locality||"Ongole")}/></label><label>City<input required name="city" defaultValue={String(defaults?.city||"Ongole")}/></label>
    <label>District<input required name="district" defaultValue={String(defaults?.district||"Prakasam")}/></label><label>State<input required name="state" defaultValue={String(defaults?.state||"Andhra Pradesh")}/></label>
    <label>Latitude<input name="latitude" type="number" step="any" defaultValue={String(defaults?.latitude||"")}/></label><label>Longitude<input name="longitude" type="number" step="any" defaultValue={String(defaults?.longitude||"")}/></label>
    <label>Security deposit<input name="security_deposit" type="number" min="0" defaultValue={String(defaults?.security_deposit||"")}/></label><label>Total capacity<input name="capacity" type="number" min="1" defaultValue={String(defaults?.capacity||"")}/></label>
    <label>Food type<input name="food_type" maxLength={80} placeholder="Vegetarian / mixed" defaultValue={String(defaults?.food_type||"")}/></label>
    <fieldset className="wide"><legend>Amenities</legend><div className="check-grid">{PG_AMENITIES.map((item)=><label key={item}><input type="checkbox" name={`amenity_${item}`} value={item} defaultChecked={amenities.includes(item)}/>{item}</label>)}</div></fieldset>
    <label className="wide">House rules (one per line)<textarea name="house_rules" rows={4} defaultValue={(defaults?.house_rules as string[]|undefined)?.join("\n")||""}/></label>
    <label className="wide">Video URLs (one per line)<textarea name="video_urls" rows={3} defaultValue={(defaults?.video_urls as string[]|undefined)?.join("\n")||""}/></label>
    <h2 className="wide">Contact information</h2><label>Contact name<input name="contact_name" defaultValue={String(defaults?.contact_name||"")}/></label><label>Mobile<input name="contact_mobile" inputMode="tel" defaultValue={String(defaults?.contact_mobile||"")}/></label><label>WhatsApp<input name="contact_whatsapp" inputMode="tel" defaultValue={String(defaults?.contact_whatsapp||"")}/></label><label>Email<input name="contact_email" type="email" defaultValue={String(defaults?.contact_email||"")}/></label>
    <button className="button" type="submit">{defaults?.id?"Save changes":"Create draft"}</button>
  </form>;
}
