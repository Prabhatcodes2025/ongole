"use client";

import {FormEvent,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {CaptchaWidget} from "@/src/components/captcha-widget";
import {PropertyPostingFields} from "@/src/components/property-posting-fields";
import type {PropertyCatalogData} from "@/src/config/property-catalog";

const STORAGE_KEY="ongoleproperty.pending-property";
const MEDIA_DB="ongoleproperty-guest-media",MEDIA_STORE="pending-property";
type Values=Record<string,string>;
type ApiFailure={error?:string;message?:string;fields?:Record<string,string|string[]>};

function valuesFrom(form:HTMLFormElement){
  const values:Values={};
  for(const[key,value]of new FormData(form).entries())if(typeof value==="string"&&key!=="cf-turnstile-response")values[key]=value;
  return values;
}

function draftKey(){return crypto.randomUUID()}
function mediaDatabase(){return new Promise<IDBDatabase>((resolve,reject)=>{if(!window.indexedDB){reject(new Error("IndexedDB unavailable"));return}const request=window.indexedDB.open(MEDIA_DB,2);request.onupgradeneeded=()=>{for(const store of ["pending-pg",MEDIA_STORE])if(!request.result.objectStoreNames.contains(store))request.result.createObjectStore(store)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function storeGuestMedia(files:File[]){const db=await mediaDatabase();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction(MEDIA_STORE,"readwrite");transaction.objectStore(MEDIA_STORE).put(files,"files");transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});db.close()}
async function readGuestMedia(){const db=await mediaDatabase();const files=await new Promise<File[]>((resolve,reject)=>{const request=db.transaction(MEDIA_STORE,"readonly").objectStore(MEDIA_STORE).get("files");request.onsuccess=()=>resolve(Array.isArray(request.result)?request.result:[]);request.onerror=()=>reject(request.error)});db.close();return files}
async function clearGuestMedia(){const db=await mediaDatabase();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction(MEDIA_STORE,"readwrite");transaction.objectStore(MEDIA_STORE).delete("files");transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});db.close()}

export function PublicPropertyPostingForm({catalog,initialTransaction="sale"}:{catalog:PropertyCatalogData;initialTransaction?:"sale"|"rent"}){
  const[defaults,setDefaults]=useState<Values|null>(null),[submitting,setSubmitting]=useState(false),[message,setMessage]=useState(""),[mediaCount,setMediaCount]=useState(0);
  useEffect(()=>{const timeout=window.setTimeout(()=>{try{const stored=sessionStorage.getItem(STORAGE_KEY),parsed=stored?JSON.parse(stored):null;setDefaults(parsed&&typeof parsed==="object"&&Object.keys(parsed).length?parsed:{transactionType:initialTransaction})}catch{setDefaults({transactionType:initialTransaction})}},0);return()=>window.clearTimeout(timeout)},[initialTransaction]);
  async function continueToAccount(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSubmitting(true);setMessage("");
    const form=event.currentTarget;
    if(!form.reportValidity()){setSubmitting(false);return}
    const values=valuesFrom(form);values.draftKey=values.draftKey||draftKey();
    sessionStorage.setItem(STORAGE_KEY,JSON.stringify(values));
    try{
      const response=await fetch("/api/auth/context",{headers:{accept:"application/json"},cache:"no-store"});
      window.location.assign(response.ok?"/dashboard/properties/new?restore=1":"/login?returnTo=%2Fdashboard%2Fproperties%2Fnew%3Frestore%3D1");
    }catch{setMessage("Your details are saved in this browser. Check your connection and try again.");setSubmitting(false)}
  }
  async function chooseMedia(event:React.ChangeEvent<HTMLInputElement>){const files=Array.from(event.target.files||[]);if(files.length>6||files.some(file=>file.size>15*1024*1024)){setMessage("Choose up to 6 JPG, PNG or WebP photos, each no larger than 15 MB.");event.target.value="";return}try{await storeGuestMedia(files);setMediaCount(files.length);setMessage(files.length?`${files.length} photo${files.length===1?"":"s"} saved in this browser until sign-in.`:"")}catch{setMessage("This browser cannot retain selected photos across sign-in. Your form is saved, but you may need to select photos again.")}}
  if(!defaults)return <p role="status">Preparing the property form…</p>;
  return <form className="submission-form property-posting-form" onSubmit={continueToAccount}><PropertyPostingFields catalog={catalog} defaults={defaults}/><input type="hidden" name="draftKey"/><label className="wide guest-media-field">Photos <span>(optional before sign-in)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseMedia}/><small>Up to 6 photos remain local and upload only after verified authentication.</small></label>{mediaCount>0&&<p className="form-note">{mediaCount} photo{mediaCount===1?"":"s"} ready to continue.</p>}<label className="consent"><input required type="checkbox" name="declaration" value="accepted" defaultChecked={defaults.declaration==="accepted"}/> I confirm that I am authorised to submit this property and that the information is accurate.</label><CaptchaWidget/>{message&&<p className="form-message error" role="alert">{message}</p>}<button className="button" type="submit" disabled={submitting}>{submitting?"Continuing…":"Sign in / Create Account"}</button><p className="form-note"><strong>Sign-in required:</strong> Your entries and selected photos are kept temporarily in this browser. Upload begins only after sign-in and verified authorization.</p></form>;
}

export function DashboardPropertyDraftForm({catalog}:{catalog:PropertyCatalogData}){
  const router=useRouter(),formRef=useRef<HTMLFormElement>(null);
  const[defaults,setDefaults]=useState<Values|null>(null),[submitting,setSubmitting]=useState(false),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({});
  useEffect(()=>{const timeout=window.setTimeout(()=>{try{const stored=sessionStorage.getItem(STORAGE_KEY);const parsed=stored?JSON.parse(stored):{};setDefaults({...parsed,draftKey:parsed.draftKey||draftKey()})}catch{setDefaults({draftKey:draftKey()})}},0);return()=>window.clearTimeout(timeout)},[]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setSubmitting(true);setMessage("");setErrors({});
    const body=new FormData(form);const current=valuesFrom(form);sessionStorage.setItem(STORAGE_KEY,JSON.stringify(current));
    try{
      const response=await fetch("/api/properties",{method:"POST",headers:{accept:"application/json"},body});const result=await response.json().catch(()=>({})) as ApiFailure&{editUrl?:string;id?:string};
      if(response.status===401){window.location.assign("/login?returnTo=%2Fdashboard%2Fproperties%2Fnew%3Frestore%3D1");return}
      if(response.ok&&result.editUrl){const files=await readGuestMedia().catch(()=>[]);let destination=result.editUrl,mediaCompleted=files.length===0;if(files.length&&result.id){const mediaBody=new FormData();for(const file of files)mediaBody.append("image",file);const upload=await fetch(`/api/properties/${result.id}/media`,{method:"POST",body:mediaBody}).catch(()=>null);if(upload?.url.startsWith(window.location.origin)){const uploadUrl=new URL(upload.url);destination=`${uploadUrl.pathname}${uploadUrl.search}`;mediaCompleted=upload.ok&&!/[?&]media=(?:failed|invalid|limit)/.test(uploadUrl.search)}}sessionStorage.removeItem(STORAGE_KEY);if(mediaCompleted)await clearGuestMedia().catch(()=>undefined);router.push(destination);return}
      const fieldErrors=Object.fromEntries(Object.entries(result.fields||{}).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));setErrors(fieldErrors);setMessage(result.message||result.error||"The draft could not be saved.");
      const first=Object.keys(fieldErrors)[0];const control=first?form.elements.namedItem(first):null;if(control instanceof HTMLElement){control.focus();control.scrollIntoView({behavior:"smooth",block:"center"})}
    }catch{setMessage("The draft could not be saved. Check your connection and try again.")}finally{setSubmitting(false)}
  }
  if(!defaults)return <p role="status">Restoring your property details…</p>;
  return <form ref={formRef} className="submission-form compact-form property-posting-form" onSubmit={save}><PropertyPostingFields catalog={catalog} defaults={defaults}/><input type="hidden" name="draftKey" value={defaults.draftKey}/><label className="consent"><input required type="checkbox" name="declaration" value="accepted" defaultChecked={defaults.declaration==="accepted"}/> I confirm that I am authorised to submit this property and that the information is accurate.</label><CaptchaWidget/>{message&&<div className="form-message error" role="alert"><p>{message}</p>{Object.entries(errors).length>0&&<ul>{Object.entries(errors).map(([field,error])=><li key={field}><button type="button" onClick={()=>formRef.current?.elements.namedItem(field) instanceof HTMLElement&&(formRef.current.elements.namedItem(field) as HTMLElement).focus()}>{error}</button></li>)}</ul>}</div>}<button className="button" type="submit" disabled={submitting}>{submitting?"Saving draft…":"Save property draft"}</button></form>;
}

export function AsyncPropertyForm({action,children,successUrl}:{action:string;children:React.ReactNode;successUrl:string}){
  const router=useRouter(),formRef=useRef<HTMLFormElement>(null);const[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({});
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setBusy(true);setMessage("");setErrors({});try{const response=await fetch(action,{method:"POST",headers:{accept:"application/json"},body:new FormData(form)});const result=await response.json().catch(()=>({})) as ApiFailure;if(response.ok){router.push(successUrl);router.refresh();return}const fieldErrors=Object.fromEntries(Object.entries(result.fields||{}).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));setErrors(fieldErrors);setMessage(result.message||result.error||"Please correct the form and try again.");const first=Object.keys(fieldErrors)[0];const control=first?form.elements.namedItem(first):null;if(control instanceof HTMLElement){control.focus();control.scrollIntoView({behavior:"smooth",block:"center"})}}catch{setMessage("The request could not be completed. Check your connection and try again.")}finally{setBusy(false)}}
  return <form ref={formRef} className="submission-form compact-form property-posting-form" onSubmit={submit}>{children}{message&&<div className="form-message error" role="alert"><p>{message}</p>{Object.values(errors).map(error=><small className="field-error" key={error}>{error}</small>)}</div>}<button className="button" type="submit" disabled={busy}>{busy?"Saving…":"Save changes"}</button></form>;
}

export function AsyncSubmitProperty({action,successUrl}:{action:string;successUrl:string}){
  const router=useRouter();const[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");try{const response=await fetch(action,{method:"POST",headers:{accept:"application/json"},body:new FormData(event.currentTarget)});const result=await response.json().catch(()=>({})) as ApiFailure;if(response.ok){router.push(successUrl);router.refresh()}else setMessage(result.error||"The property could not be submitted.")}catch{setMessage("The property could not be submitted. Check your connection and try again.")}finally{setBusy(false)}}
  return <form onSubmit={submit}><CaptchaWidget/>{message&&<p className="form-message error" role="alert">{message}</p>}<button className="button" type="submit" disabled={busy}>{busy?"Submitting…":"Submit for review"}</button></form>;
}
