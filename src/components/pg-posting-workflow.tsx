"use client";

import {FormEvent,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {PG_AMENITIES} from "@/src/types/pg";

const STORAGE_KEY="ongoleproperty.pending-pg";
type Values=Record<string,string>;
type Failure={error?:string;fields?:Record<string,string|string[]>;editUrl?:string};
function valuesFrom(form:HTMLFormElement){const values:Values={};for(const[key,value]of new FormData(form).entries())if(typeof value==="string")values[key]=value;return values}

export function PgFields({defaults}:{defaults?:Record<string,unknown>}){
  const amenities=Array.isArray(defaults?.amenities)?defaults.amenities as string[]:[];
  return <>
    <label className="wide">PG name<input required name="pg_name" minLength={3} maxLength={120} defaultValue={String(defaults?.pg_name||"")}/></label>
    <label>Category<select required name="category" defaultValue={String(defaults?.category||"co_living")}><option value="mens">Paying Guest for Men</option><option value="womens">Paying Guest for Women</option><option value="co_living">Co-Living</option></select></label>
    <label>Starting rent per bed<input required type="number" name="rent_per_bed" min="0" step="1" defaultValue={String(defaults?.rent_per_bed||0)}/></label>
    <label className="wide">Description <span>(20–250 characters; no contact details, links or advertisements)</span><textarea required name="description" minLength={20} maxLength={250} rows={5} defaultValue={String(defaults?.description||"")}/></label>
    <label className="wide compact-field">Street address<textarea required name="address_line" rows={2} defaultValue={String(defaults?.address_line||"")}/></label>
    <label>Locality<input required name="locality" placeholder="Gopal Nagar" defaultValue={String(defaults?.locality||"")}/></label><label>Mandal/Town<input required name="city" defaultValue={String(defaults?.city||"Ongole")}/></label>
    <label>District<input required name="district" defaultValue={String(defaults?.district||"Prakasam")}/></label><label>State<input required name="state" defaultValue={String(defaults?.state||"Andhra Pradesh")}/></label>
    <label>Latitude<input name="latitude" type="number" step="any" defaultValue={String(defaults?.latitude||"")}/></label><label>Longitude<input name="longitude" type="number" step="any" defaultValue={String(defaults?.longitude||"")}/></label>
    <label>Nearby landmark <span>(optional)</span><input name="landmark" maxLength={160} defaultValue={String(defaults?.landmark||"")}/></label><label>Total capacity<input name="capacity" type="number" min="1" defaultValue={String(defaults?.capacity||"")}/></label>
    <label>Food type<input name="food_type" maxLength={80} placeholder="Vegetarian / mixed" defaultValue={String(defaults?.food_type||"")}/></label><label className="check-label"><input type="checkbox" name="lunch_box_available" value="true" defaultChecked={defaults?.lunch_box_available===true||defaults?.lunch_box_available==="true"}/>Lunch Box Available</label>
    <fieldset className="wide"><legend>Amenities</legend><div className="check-grid">{PG_AMENITIES.map(item=><label key={item}><input type="checkbox" name={`amenity_${item}`} value={item} defaultChecked={amenities.includes(item)||defaults?.[`amenity_${item}`]===item}/>{item}</label>)}</div></fieldset>
    <label className="wide">House rules (one per line)<textarea name="house_rules" rows={3} placeholder="Example: Gate closes at 10 PM, No smoking inside, Only vegetarian tenants" defaultValue={(defaults?.house_rules as string[]|undefined)?.join("\n")||String(defaults?.house_rules||"")}/></label>
    <label className="wide compact-field">YouTube video URLs only (one per line)<textarea name="video_urls" rows={2} defaultValue={(defaults?.video_urls as string[]|undefined)?.join("\n")||String(defaults?.video_urls||"")}/></label>
    <h2 className="wide">Contact information</h2><label>Contact name<input name="contact_name" defaultValue={String(defaults?.contact_name||"")}/></label><label>Mobile<input name="contact_mobile" inputMode="tel" defaultValue={String(defaults?.contact_mobile||"")}/></label><label>WhatsApp<input name="contact_whatsapp" inputMode="tel" defaultValue={String(defaults?.contact_whatsapp||"")}/></label><label>Email<input name="contact_email" type="email" defaultValue={String(defaults?.contact_email||"")}/></label>
  </>;
}

export function PublicPgPostingForm(){
  const[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function continueToAccount(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setBusy(true);setMessage("");try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(valuesFrom(form)));const response=await fetch("/api/auth/context",{headers:{accept:"application/json"},cache:"no-store"});window.location.assign(response.ok?"/dashboard/pg/new?restore=1":"/login?returnTo=%2Fdashboard%2Fpg%2Fnew%3Frestore%3D1")}catch{setMessage("Your details are saved in this browser. Check your connection and try again.");setBusy(false)}}
  return <form className="submission-form compact-form" onSubmit={continueToAccount}><PgFields/><p className="form-note wide"><strong>Sign-in required:</strong> Your entered details and video links will be restored after verified sign-in. For security, choose photo files after authentication.</p>{message&&<p className="form-message error wide" role="alert">{message}</p>}<button className="button" disabled={busy}>{busy?"Continuing…":"Submit Your PG"}</button></form>;
}

export function DashboardPgDraftForm(){
  const router=useRouter(),formRef=useRef<HTMLFormElement>(null);const[defaults,setDefaults]=useState<Values|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({});
  useEffect(()=>{const timeout=window.setTimeout(()=>{try{const stored=sessionStorage.getItem(STORAGE_KEY);setDefaults(stored?JSON.parse(stored):{})}catch{setDefaults({})}},0);return()=>window.clearTimeout(timeout)},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setBusy(true);setMessage("");setErrors({});sessionStorage.setItem(STORAGE_KEY,JSON.stringify(valuesFrom(form)));try{const response=await fetch("/api/pg",{method:"POST",headers:{accept:"application/json"},body:new FormData(form)});const result=await response.json().catch(()=>({})) as Failure;if(response.status===401||response.status===403){window.location.assign("/login?returnTo=%2Fdashboard%2Fpg%2Fnew%3Frestore%3D1");return}if(response.ok&&result.editUrl){sessionStorage.removeItem(STORAGE_KEY);router.push(result.editUrl);return}const fields=Object.fromEntries(Object.entries(result.fields||{}).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));setErrors(fields);setMessage(result.error||"Check the PG details and try again.");const first=Object.keys(fields)[0];const control=first?form.elements.namedItem(first):null;if(control instanceof HTMLElement){control.focus();control.scrollIntoView({behavior:"smooth",block:"center"})}}catch{setMessage("The PG listing could not be saved. Check your connection and try again.")}finally{setBusy(false)}}
  if(!defaults)return <p role="status">Restoring your PG details…</p>;
  return <form ref={formRef} className="submission-form compact-form" onSubmit={submit}><PgFields defaults={defaults}/>{message&&<div className="form-message error wide" role="alert"><p>{message}</p>{Object.values(errors).map(error=><small className="field-error" key={error}>{error}</small>)}</div>}<button className="button" disabled={busy}>{busy?"Saving…":"Submit Your PG"}</button></form>;
}

export function PgForm({defaults}:{defaults?:Record<string,unknown>}){return <form className="submission-form compact-form" action={`/api/pg/${defaults?.id}`} method="post"><input type="hidden" name="action" value="update"/><PgFields defaults={defaults}/><button className="button" type="submit">Save changes</button></form>}
