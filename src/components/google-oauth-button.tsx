"use client";

import {useRef,useState} from "react";

export function GoogleOAuthButton({returnTo,accountType,accountLabel,showKeepSignedIn=false}:{returnTo:string;accountType?:string;accountLabel?:string;showKeepSignedIn?:boolean}){
  const startingRef=useRef(false);
  const [starting,setStarting]=useState(false);
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [keepSignedIn,setKeepSignedIn]=useState(false);
  const [error,setError]=useState("");
  const requiresTerms=Boolean(accountType);

  function startGoogleOAuth(){
    if(startingRef.current)return;
    if(requiresTerms&&!termsAccepted){setError("Please accept the Terms & Conditions.");return}
    startingRef.current=true;setStarting(true);setError("");
    const query=new URLSearchParams({returnTo});
    if(keepSignedIn)query.set("keepSignedIn","accepted");
    if(accountType){query.set("accountType",accountType);query.set("termsAccepted","accepted")}
    window.location.assign(`/api/auth/google?${query.toString()}`);
  }

  return <div className="oauth-form">
    {requiresTerms&&<label className="consent auth-consent"><input type="checkbox" checked={termsAccepted} onChange={(event)=>{setTermsAccepted(event.target.checked);setError("")}}/><span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.</span></label>}
    {showKeepSignedIn&&<label className="consent auth-consent"><input type="checkbox" checked={keepSignedIn} onChange={event=>setKeepSignedIn(event.target.checked)}/><span>Keep me signed in on this device</span></label>}
    {error&&<p className="form-message error" role="alert">{error}</p>}
    <button className="button button-light" type="button" disabled={starting} aria-disabled={starting} onClick={startGoogleOAuth}>{starting?"Connecting to Google…":`Continue with Google${accountLabel?` as ${accountLabel}`:""}`}</button>
  </div>
}
