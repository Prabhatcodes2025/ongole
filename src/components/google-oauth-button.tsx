"use client";

import Script from "next/script";
import {useCallback,useEffect,useRef,useState} from "react";
import {createSupabaseBrowserClient} from "@/src/lib/supabase/browser";

type CredentialResponse={credential?:string};
declare global{interface Window{google?:{accounts:{id:{initialize:(options:{client_id:string;callback:(response:CredentialResponse)=>void;auto_select:boolean})=>void;renderButton:(element:HTMLElement,options:{theme:string;size:string;width:number})=>void}}}}}

export function GoogleOAuthButton({returnTo,accountType,accountLabel,showKeepSignedIn=false}:{returnTo:string;accountType?:string;accountLabel?:string;showKeepSignedIn?:boolean}){
  const startingRef=useRef(false);
  const buttonRef=useRef<HTMLDivElement>(null);
  const [starting,setStarting]=useState(false);
  const [gisReady,setGisReady]=useState(false);
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [keepSignedIn,setKeepSignedIn]=useState(false);
  const [error,setError]=useState("");
  const requiresTerms=Boolean(accountType);

  const clientId=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const stop=useCallback((message:string)=>{startingRef.current=false;setStarting(false);setError(message)},[]);

  const finishGoogleSignIn=useCallback(async(response:CredentialResponse)=>{
    if(!response.credential){stop("Google did not return a sign-in credential. Please try again.");return}
    const supabase=createSupabaseBrowserClient();
    if(!supabase){stop("Google sign-in is not configured. Please use email and password.");return}
    try{
    const{error:tokenError}=await supabase.auth.signInWithIdToken({provider:"google",token:response.credential});
    if(tokenError){stop("Google sign-in could not be completed. Please try again.");return}
    const result=await fetch("/api/auth/google",{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({returnTo,accountType,termsAccepted:requiresTerms?"accepted":undefined,keepSignedIn:keepSignedIn?"accepted":undefined})}).catch(()=>null);
    const payload=await result?.json().catch(()=>null) as {redirectTo?:string;error?:string}|null;
    if(!result?.ok||!payload?.redirectTo){await supabase.auth.signOut();stop(payload?.error||"Google sign-in could not be completed. Please try again.");return}
    window.location.assign(payload.redirectTo);
    }catch{stop("Google sign-in could not be completed. Check your connection and try again.")}
  },[returnTo,accountType,requiresTerms,keepSignedIn,stop]);

  useEffect(()=>{
    if(!clientId||!gisReady||requiresTerms&&!termsAccepted||!buttonRef.current||!window.google)return;
    try{
      window.google.accounts.id.initialize({client_id:clientId,auto_select:false,callback:(response)=>{
        if(startingRef.current)return;
        startingRef.current=true;setStarting(true);setError("");
        void finishGoogleSignIn(response);
      }});
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current,{theme:"outline",size:"large",width:300});
    }catch{queueMicrotask(()=>stop("Google sign-in could not be loaded. Please use email and password."))}
  },[clientId,gisReady,requiresTerms,termsAccepted,finishGoogleSignIn,stop]);

  return <div className="oauth-form">
    {clientId&&<Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={()=>setGisReady(true)} onError={()=>stop("Google sign-in could not be loaded. Please use email and password.")}/>}
    {requiresTerms&&<label className="consent auth-consent"><input type="checkbox" checked={termsAccepted} onChange={(event)=>{setTermsAccepted(event.target.checked);setError("")}}/><span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.</span></label>}
    {showKeepSignedIn&&<label className="consent auth-consent"><input type="checkbox" checked={keepSignedIn} onChange={event=>setKeepSignedIn(event.target.checked)}/><span>Keep me signed in on this device</span></label>}
    {error&&<p className="form-message error" role="alert">{error}</p>}
    {clientId&&gisReady&&(!requiresTerms||termsAccepted)?<div ref={buttonRef} aria-busy={starting}/>:<button className="button button-light" type="button" disabled={starting||Boolean(clientId&&!gisReady)} onClick={()=>setError(!clientId?"Google sign-in needs NEXT_PUBLIC_GOOGLE_CLIENT_ID. Please use email and password for now.":"Please accept the Terms & Conditions.")}>{clientId&&!gisReady?"Loading Google sign-in…":`Continue with Google${accountLabel?` as ${accountLabel}`:""}`}</button>}
  </div>
}
