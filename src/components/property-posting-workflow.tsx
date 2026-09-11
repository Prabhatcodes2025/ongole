"use client";

import {FormEvent,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {CaptchaWidget} from "@/src/components/captcha-widget";
import {PropertyPostingFields} from "@/src/components/property-posting-fields";
import type {PropertyCatalogData} from "@/src/config/property-catalog";

const STORAGE_KEY="ongoleproperty.pending-property";
type Values=Record<string,string>;
type ApiFailure={error?:string;message?:string;fields?:Record<string,string|string[]>};

function valuesFrom(form:HTMLFormElement){
  const values:Values={};
  for(const[key,value]of new FormData(form).entries())if(typeof value==="string"&&key!=="cf-turnstile-response")values[key]=value;
  return values;
}

function draftKey(){return crypto.randomUUID()}

export function PublicPropertyPostingForm({catalog}:{catalog:PropertyCatalogData}){
  const[submitting,setSubmitting]=useState(false),[message,setMessage]=useState("");
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
  return <form className="submission-form" onSubmit={continueToAccount}><PropertyPostingFields catalog={catalog}/><input type="hidden" name="draftKey"/><label className="consent"><input required type="checkbox" name="declaration" value="accepted"/> I confirm that I am authorised to submit this property and that the information is accurate.</label><CaptchaWidget/>{message&&<p className="form-message error" role="alert">{message}</p>}<button className="button" type="submit" disabled={submitting}>{submitting?"Continuing…":"Sign in / Create Account"}</button><p className="form-note"><strong>Sign-in required:</strong> Your entries are kept temporarily in this browser. Sign in or register and verify your email before a property draft is created.</p></form>;
}

export function DashboardPropertyDraftForm({catalog}:{catalog:PropertyCatalogData}){
  const router=useRouter(),formRef=useRef<HTMLFormElement>(null);
  const[defaults,setDefaults]=useState<Values|null>(null),[submitting,setSubmitting]=useState(false),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({});
  useEffect(()=>{const timeout=window.setTimeout(()=>{try{const stored=sessionStorage.getItem(STORAGE_KEY);const parsed=stored?JSON.parse(stored):{};setDefaults({...parsed,draftKey:parsed.draftKey||draftKey()})}catch{setDefaults({draftKey:draftKey()})}},0);return()=>window.clearTimeout(timeout)},[]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setSubmitting(true);setMessage("");setErrors({});
    const body=new FormData(form);const current=valuesFrom(form);sessionStorage.setItem(STORAGE_KEY,JSON.stringify(current));
    try{
      const response=await fetch("/api/properties",{method:"POST",headers:{accept:"application/json"},body});const result=await response.json().catch(()=>({})) as ApiFailure&{editUrl?:string};
      if(response.status===401){window.location.assign("/login?returnTo=%2Fdashboard%2Fproperties%2Fnew%3Frestore%3D1");return}
      if(response.ok&&result.editUrl){sessionStorage.removeItem(STORAGE_KEY);router.push(result.editUrl);return}
      const fieldErrors=Object.fromEntries(Object.entries(result.fields||{}).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));setErrors(fieldErrors);setMessage(result.message||result.error||"The draft could not be saved.");
      const first=Object.keys(fieldErrors)[0];const control=first?form.elements.namedItem(first):null;if(control instanceof HTMLElement){control.focus();control.scrollIntoView({behavior:"smooth",block:"center"})}
    }catch{setMessage("The draft could not be saved. Check your connection and try again.")}finally{setSubmitting(false)}
  }
  if(!defaults)return <p role="status">Restoring your property details…</p>;
  return <form ref={formRef} className="submission-form compact-form" onSubmit={save}><PropertyPostingFields catalog={catalog} defaults={defaults}/><input type="hidden" name="draftKey" value={defaults.draftKey}/><label className="consent"><input required type="checkbox" name="declaration" value="accepted" defaultChecked={defaults.declaration==="accepted"}/> I confirm that I am authorised to submit this property and that the information is accurate.</label><CaptchaWidget/>{message&&<div className="form-message error" role="alert"><p>{message}</p>{Object.entries(errors).length>0&&<ul>{Object.entries(errors).map(([field,error])=><li key={field}><button type="button" onClick={()=>formRef.current?.elements.namedItem(field) instanceof HTMLElement&&(formRef.current.elements.namedItem(field) as HTMLElement).focus()}>{error}</button></li>)}</ul>}</div>}<button className="button" type="submit" disabled={submitting}>{submitting?"Saving draft…":"Save property draft"}</button></form>;
}

export function AsyncPropertyForm({action,children,successUrl}:{action:string;children:React.ReactNode;successUrl:string}){
  const router=useRouter(),formRef=useRef<HTMLFormElement>(null);const[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[errors,setErrors]=useState<Record<string,string>>({});
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;setBusy(true);setMessage("");setErrors({});try{const response=await fetch(action,{method:"POST",headers:{accept:"application/json"},body:new FormData(form)});const result=await response.json().catch(()=>({})) as ApiFailure;if(response.ok){router.push(successUrl);router.refresh();return}const fieldErrors=Object.fromEntries(Object.entries(result.fields||{}).map(([key,value])=>[key,Array.isArray(value)?value[0]:value]));setErrors(fieldErrors);setMessage(result.message||result.error||"Please correct the form and try again.");const first=Object.keys(fieldErrors)[0];const control=first?form.elements.namedItem(first):null;if(control instanceof HTMLElement){control.focus();control.scrollIntoView({behavior:"smooth",block:"center"})}}catch{setMessage("The request could not be completed. Check your connection and try again.")}finally{setBusy(false)}}
  return <form ref={formRef} className="submission-form compact-form" onSubmit={submit}>{children}{message&&<div className="form-message error" role="alert"><p>{message}</p>{Object.values(errors).map(error=><small className="field-error" key={error}>{error}</small>)}</div>}<button className="button" type="submit" disabled={busy}>{busy?"Saving…":"Save changes"}</button></form>;
}

export function AsyncSubmitProperty({action,successUrl}:{action:string;successUrl:string}){
  const router=useRouter();const[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");try{const response=await fetch(action,{method:"POST",headers:{accept:"application/json"},body:new FormData(event.currentTarget)});const result=await response.json().catch(()=>({})) as ApiFailure;if(response.ok){router.push(successUrl);router.refresh()}else setMessage(result.error||"The property could not be submitted.")}catch{setMessage("The property could not be submitted. Check your connection and try again.")}finally{setBusy(false)}}
  return <form onSubmit={submit}><CaptchaWidget/>{message&&<p className="form-message error" role="alert">{message}</p>}<button className="button" type="submit" disabled={busy}>{busy?"Submitting…":"Submit for review"}</button></form>;
}
