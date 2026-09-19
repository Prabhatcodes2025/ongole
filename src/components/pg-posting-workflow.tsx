"use client";

import {FormEvent,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {PG_AMENITIES} from "@/src/types/pg";
import {facingOptions} from "@/src/config/property-catalog";
import {MandalTownAutocomplete} from "@/src/components/mandal-town-autocomplete";
import {NearbyPlaceFields} from "@/src/components/nearby-place-fields";
import {PropertyLocationPicker} from "@/src/components/property-location-picker";

const STORAGE_KEY="ongoleproperty.pending-pg";
const STORAGE_VERSION=1;
const MAX_AGE_MS=14*24*60*60*1000;
const MEDIA_DB="ongoleproperty-guest-media";
const MEDIA_STORE="pending-pg";
type Values=Record<string,string>;
type StoredDraft={version:number;savedAt:number;values:Values};
type Failure={error?:string;fields?:Record<string,string|string[]>;editUrl?:string;propertyId?:string};

function valuesFrom(form:HTMLFormElement){const values:Values={};for(const[key,value]of new FormData(form).entries())if(typeof value==="string")values[key]=value;return values}
function foodTypeDefault(value:unknown){const normalized=String(value||"").trim().toLowerCase();if(!normalized)return"";if(normalized.includes("mixed"))return"Mixed";if(normalized.includes("non")&&normalized.includes("veg"))return"Non-Vegetarian";if(normalized.includes("veg"))return"Vegetarian";return""}
function saveDraft(values:Values){const payload:StoredDraft={version:STORAGE_VERSION,savedAt:Date.now(),values};localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));sessionStorage.setItem(STORAGE_KEY,JSON.stringify(values))}
function readDraft(){try{const current=localStorage.getItem(STORAGE_KEY);if(current){const parsed=JSON.parse(current) as StoredDraft;if(parsed.version===STORAGE_VERSION&&Date.now()-parsed.savedAt<MAX_AGE_MS&&parsed.values&&typeof parsed.values==="object")return parsed.values;localStorage.removeItem(STORAGE_KEY)}const legacy=sessionStorage.getItem(STORAGE_KEY);return legacy?JSON.parse(legacy) as Values:{}}catch{return{}}}
function clearDraft(){localStorage.removeItem(STORAGE_KEY);sessionStorage.removeItem(STORAGE_KEY)}
function mediaDatabase(){return new Promise<IDBDatabase>((resolve,reject)=>{if(!window.indexedDB){reject(new Error("IndexedDB unavailable"));return}const request=window.indexedDB.open(MEDIA_DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(MEDIA_STORE))request.result.createObjectStore(MEDIA_STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function storeGuestMedia(files:File[]){const db=await mediaDatabase();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction(MEDIA_STORE,"readwrite");transaction.objectStore(MEDIA_STORE).put(files,"files");transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});db.close()}
async function readGuestMedia(){const db=await mediaDatabase();const files=await new Promise<File[]>((resolve,reject)=>{const request=db.transaction(MEDIA_STORE,"readonly").objectStore(MEDIA_STORE).get("files");request.onsuccess=()=>resolve(Array.isArray(request.result)?request.result:[]);request.onerror=()=>reject(request.error)});db.close();return files}
async function clearGuestMedia(){const db=await mediaDatabase();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction(MEDIA_STORE,"readwrite");transaction.objectStore(MEDIA_STORE).delete("files");transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});db.close()}

const amenityLabels:Record<string,string>={WiFi:"Wi-Fi",Food:"Meals"};

export function PgFields({defaults}:{defaults?:Record<string,unknown>}){
  const amenities=Array.isArray(defaults?.amenities)?defaults.amenities as string[]:[];
  return <>
    <label className="wide">PG name<input required name="pg_name" minLength={3} maxLength={120} defaultValue={String(defaults?.pg_name||"")}/></label>
    <label>Category<select required name="category" defaultValue={String(defaults?.category||"co_living")}><option value="mens">Paying Guest for Men</option><option value="womens">Paying Guest for Women</option><option value="co_living">Co-Living</option></select></label>
    <label>Starting rent per bed<input required type="number" name="rent_per_bed" min="0" step="1" defaultValue={String(defaults?.rent_per_bed||0)}/></label><label>Rent basis<select aria-label="PG rent basis" value="per_bed_month" disabled><option value="per_bed_month">Per bed / month</option></select></label>
    <label className="wide">Description <span>(20–250 characters; no contact details, links or advertisements)</span><textarea required name="description" minLength={20} maxLength={250} rows={5} defaultValue={String(defaults?.description||"")}/></label>
    <label className="wide compact-field">Street address<textarea required name="address_line" rows={2} defaultValue={String(defaults?.address_line||"")}/></label>
    <label>Locality<input required name="locality" placeholder="Gopal Nagar" defaultValue={String(defaults?.locality||"")}/></label><MandalTownAutocomplete required defaultValue={String(defaults?.city||"Ongole")}/>
    <label>District<input required name="district" defaultValue={String(defaults?.district||"Prakasam")}/></label><label>State<input required name="state" defaultValue={String(defaults?.state||"Andhra Pradesh")}/></label>
    <PropertyLocationPicker latitude={defaults?.latitude} longitude={defaults?.longitude}/>
    <label>Nearby landmark <span>(optional)</span><input name="landmark" maxLength={160} defaultValue={String(defaults?.landmark||"")}/></label><label>Facing<select name="facing" defaultValue={String(defaults?.facing||"")}><option value="">Choose facing</option>{facingOptions.map(facing=><option key={facing}>{facing}</option>)}</select></label><label>Total capacity<input name="capacity" type="number" min="1" defaultValue={String(defaults?.capacity||"")}/></label>
    <NearbyPlaceFields defaults={defaults}/>
    <label>Food type<select name="food_type" defaultValue={foodTypeDefault(defaults?.food_type)}><option value="">Choose food type</option><option value="Vegetarian">Vegetarian</option><option value="Non-Vegetarian">Non-Vegetarian</option><option value="Mixed">Mixed</option></select></label><label className="check-label pg-inline-check"><input type="checkbox" name="lunch_box_available" value="true" defaultChecked={defaults?.lunch_box_available===true||defaults?.lunch_box_available==="true"}/>Lunch Box Available</label>
    <fieldset className="wide pg-amenities"><legend>Amenities</legend><div className="check-grid">{PG_AMENITIES.map(item=><label key={item}><input type="checkbox" name={`amenity_${item}`} value={item} defaultChecked={amenities.includes(item)||defaults?.[`amenity_${item}`]===item}/><span>{amenityLabels[item]||item}</span></label>)}</div></fieldset>
    <label className="wide">House rules (one per line)<textarea name="house_rules" rows={3} placeholder="Example: Gate closes at 10 PM, No smoking inside, Only vegetarian tenants" defaultValue={(defaults?.house_rules as string[]|undefined)?.join("\n")||String(defaults?.house_rules||"")}/></label>
    <label className="wide compact-field">YouTube video URLs only (one per line)<textarea name="video_urls" rows={2} defaultValue={(defaults?.video_urls as string[]|undefined)?.join("\n")||String(defaults?.video_urls||"")}/></label>
    <h2 className="wide">Contact information</h2><label>Contact name<input name="contact_name" defaultValue={String(defaults?.contact_name||"")}/></label><label>Mobile<input name="contact_mobile" inputMode="tel" defaultValue={String(defaults?.contact_mobile||"")}/></label><label>WhatsApp<input name="contact_whatsapp" inputMode="tel" defaultValue={String(defaults?.contact_whatsapp||"")}/></label><label>Email<input name="contact_email" type="email" defaultValue={String(defaults?.contact_email||"")}/></label>
    <label className="check-label wide consent-field"><input required type="checkbox" name="consent" value="true" defaultChecked={defaults?.consent==="true"}/>I confirm I am authorized to post this listing, and I consent to receive SMS, WhatsApp, and Email communications regarding this listing.</label>
  </>;
}

export function PublicPgPostingForm(){
  const formRef=useRef<HTMLFormElement>(null),saveTimer=useRef<number|undefined>(undefined);const[defaults,setDefaults]=useState<Values|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[mediaCount,setMediaCount]=useState(0);
  useEffect(()=>{const timeout=window.setTimeout(()=>setDefaults(readDraft()),0);return()=>window.clearTimeout(timeout)},[]);
  function autosave(){window.clearTimeout(saveTimer.current);saveTimer.current=window.setTimeout(()=>{if(formRef.current)saveDraft(valuesFrom(formRef.current))},350)}
  async function chooseMedia(event:React.ChangeEvent<HTMLInputElement>){const files=Array.from(event.target.files||[]);if(files.length>6||files.some(file=>file.size>15*1024*1024)){setMessage("Choose up to 6 JPG, PNG or WebP photos, each no larger than 15 MB.");event.target.value="";return}try{await storeGuestMedia(files);setMediaCount(files.length);setMessage(files.length?`${files.length} photo${files.length===1?"":"s"} saved securely in this browser until sign-in.`:"")}catch{setMessage("This browser cannot retain selected photos across sign-in. Your form is saved, but you may need to select photos again after signing in.")}}
  async function continueToAccount(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setBusy(true);setMessage("");try{saveDraft(valuesFrom(form));const response=await fetch("/api/auth/context",{headers:{accept:"application/json"},cache:"no-store"});window.location.assign(response.ok?"/dashboard/pg/new?restore=1":"/login?returnTo=%2Fdashboard%2Fpg%2Fnew%3Frestore%3D1")}catch{setMessage("Your details are saved in this browser. Check your connection and try again.");setBusy(false)}}
  if(!defaults)return <p role="status">Restoring your PG details…</p>;
  return <form ref={formRef} className="submission-form compact-form pg-posting-form" onInput={autosave} onChange={autosave} onSubmit={continueToAccount}><PgFields defaults={defaults}/><label className="wide guest-media-field">Photos <span>(optional before sign-in)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseMedia}/><small>Up to 6 photos are kept only in this browser and uploaded to protected storage after verified sign-in.</small></label>{mediaCount>0&&<p className="form-note wide" role="status">{mediaCount} photo{mediaCount===1?"":"s"} ready to continue.</p>}<p className="form-note wide"><strong>Final step:</strong> Sign in or register. After a verified session, your draft and locally retained photos continue through the existing authorized upload pipeline.</p>{message&&<p className="form-message wide" role="status">{message}</p>}<button className="button" disabled={busy}>{busy?"Continuing…":"Continue to Sign In / Register"}</button></form>;
}

export function DashboardPgDraftForm(){
  const router=useRouter(),formRef=useRef<HTMLFormElement>(null);const[defaults,setDefaults]=useState<Values|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({});
  useEffect(()=>{const timeout=window.setTimeout(()=>setDefaults(readDraft()),0);return()=>window.clearTimeout(timeout)},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setBusy(true);setMessage("");setErrors({});saveDraft(valuesFrom(form));try{const response=await fetch("/api/pg",{method:"POST",headers:{accept:"application/json"},body:new FormData(form)});const result=await response.json().catch(()=>({})) as Failure;if(response.status===401||response.status===403){window.location.assign("/login?returnTo=%2Fdashboard%2Fpg%2Fnew%3Frestore%3D1");return}if(response.ok&&result.editUrl){const files=await readGuestMedia().catch(()=>[]);let destination=result.editUrl,mediaCompleted=files.length===0;if(files.length&&result.propertyId){const mediaBody=new FormData();for(const file of files)mediaBody.append("image",file);const pgId=result.editUrl.split("/")[3]?.split("?")[0],upload=await fetch(`/api/properties/${result.propertyId}/media?context=pg&pgId=${pgId}`,{method:"POST",body:mediaBody}).catch(()=>null);if(upload?.url.startsWith(window.location.origin)){const uploadUrl=new URL(upload.url);destination=`${uploadUrl.pathname}${uploadUrl.search}`;mediaCompleted=upload.ok&&!/[?&]media=(?:failed|invalid|limit)/.test(uploadUrl.search)}}clearDraft();if(mediaCompleted)await clearGuestMedia().catch(()=>undefined);router.push(destination);return}const fields=Object.fromEntries(Object.entries(result.fields||{}).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));setErrors(fields);setMessage(result.error||"Check the PG details and try again.");const first=Object.keys(fields)[0];const control=first?form.elements.namedItem(first):null;if(control instanceof HTMLElement){control.focus();control.scrollIntoView({behavior:"smooth",block:"center"})}}catch{setMessage("The PG listing could not be saved. Check your connection and try again.")}finally{setBusy(false)}}
  if(!defaults)return <p role="status">Restoring your PG details…</p>;
  return <form ref={formRef} className="submission-form compact-form pg-posting-form" onSubmit={submit}><PgFields defaults={defaults}/>{message&&<div className="form-message error wide" role="alert"><p>{message}</p>{Object.values(errors).map(error=><small className="field-error" key={error}>{error}</small>)}</div>}<button className="button" disabled={busy}>{busy?"Saving…":"Create private PG draft"}</button></form>;
}

export function PgForm({defaults}:{defaults?:Record<string,unknown>}){return <form className="submission-form compact-form pg-posting-form" action={`/api/pg/${defaults?.id}`} method="post"><input type="hidden" name="action" value="update"/><PgFields defaults={defaults}/><button className="button" type="submit">Save changes</button></form>}
