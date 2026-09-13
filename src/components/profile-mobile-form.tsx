"use client";

import {FormEvent,useEffect,useRef,useState} from "react";
import {isValidIndianMobile} from "@/src/lib/auth/mobile";

const mobileMessage="Please enter a valid 10-digit mobile number.";

export function ProfileMobileForm({completing,returnTo,initialError,profile}:{completing:boolean;returnTo?:string;initialError?:string;profile:{full_name:string|null;email:string|null;mobile:string|null;account_type:string|null;reference_no:string|null}|null}){
  const mobileRef=useRef<HTMLInputElement>(null);
  const[mobileError,setMobileError]=useState(initialError==="invalid_mobile"?mobileMessage:initialError==="mobile_unavailable"?"This mobile number is already registered.":"");
  const[message,setMessage]=useState(initialError&&!(["invalid_mobile","mobile_unavailable"].includes(initialError))?"Your profile could not be saved. Please try again.":"");
  const[busy,setBusy]=useState(false);
  function focusMobile(){mobileRef.current?.focus();mobileRef.current?.scrollIntoView({behavior:"smooth",block:"center"})}
  useEffect(()=>{if(initialError==="invalid_mobile"||initialError==="mobile_unavailable")focusMobile()},[initialError]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;setMobileError("");setMessage("");
    const mobile=mobileRef.current?.value.trim()||"";
    if((completing||mobile)&&!isValidIndianMobile(mobile)){setMobileError(mobileMessage);focusMobile();return}
    if(!form.reportValidity())return;
    setBusy(true);
    try{
      const response=await fetch("/api/profile",{method:"POST",headers:{accept:"application/json"},body:new FormData(form)});
      const result=await response.json().catch(()=>({})) as {error?:string;redirectTo?:string};
      if(response.ok&&result.redirectTo){window.location.assign(result.redirectTo);return}
      if(response.status===401){window.location.assign("/login?returnTo=%2Fdashboard%2Fprofile");return}
      if(result.error==="invalid_mobile"||result.error==="mobile_unavailable"){
        setMobileError(result.error==="invalid_mobile"?mobileMessage:"This mobile number is already registered.");focusMobile();return;
      }
      setMessage("Your profile could not be saved. Please try again.");
    }catch{setMessage("Your profile could not be saved. Check your connection and try again.")}
    finally{setBusy(false)}
  }
  return <form className="submission-form compact-form" action="/api/profile" method="post" onSubmit={submit}>
    {completing&&<input type="hidden" name="returnTo" value={returnTo}/>}
    <label>Full name<input required name="fullName" minLength={2} maxLength={120} defaultValue={profile?.full_name||""}/></label>
    <label>Email<input disabled value={profile?.email||""}/></label>
    <label>Mobile<input ref={mobileRef} required={completing} name="mobile" inputMode="numeric" pattern="[6-9][0-9]{9}" aria-invalid={Boolean(mobileError)||undefined} aria-describedby={`profile-mobile-help${mobileError?" profile-mobile-error":""}`} defaultValue={profile?.mobile||""}/><small id="profile-mobile-help">Use a unique 10-digit Indian mobile number.</small>{mobileError&&<small className="field-error" id="profile-mobile-error" role="alert">{mobileError}</small>}</label>
    <label>Account type<input disabled value={profile?.account_type||""}/></label>
    <p className="wide form-note">Reference: {profile?.reference_no}. Email and account type changes require support verification.</p>
    {message&&<p className="form-message error wide" role="alert">{message}</p>}
    <button className="button" disabled={busy}>{busy?"Saving…":completing?"Save and continue":"Save profile"}</button>
  </form>;
}
