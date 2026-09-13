"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {CaptchaWidget} from "@/src/components/captcha-widget";
import {PasswordInput} from "@/src/components/password-input";
import {createSupabaseBrowserClient} from "@/src/lib/supabase/browser";

const errors:Record<string,string>={invalid_password:"Enter a password with at least eight characters.",password_mismatch:"The passwords do not match.",update_failed:"The password could not be updated. Request a new reset link and try again."};

export function ResetPasswordForm({error,notice}:{error?:string;notice?:string}){
  const router=useRouter();const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);const[ready,setReady]=useState(false);const[sessionError,setSessionError]=useState(configured?"":"Password recovery is not configured.");
  useEffect(()=>{
    if(notice==="password_updated"){const timer=window.setTimeout(()=>router.replace("/login?notice=password_updated"),1600);return()=>window.clearTimeout(timer)}
    const supabase=createSupabaseBrowserClient();if(!supabase)return;
    let active=true;
    const prepare=async()=>{
      const url=new URL(window.location.href),code=url.searchParams.get("code"),tokenHash=url.searchParams.get("token_hash"),type=url.searchParams.get("type");const hash=new URLSearchParams(url.hash.slice(1));
      let failure:null|{message:string}=null;
      if(code)({error:failure}=await supabase.auth.exchangeCodeForSession(code));
      else if(tokenHash&&type==="recovery")({error:failure}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:"recovery"}));
      else if(hash.get("access_token")&&hash.get("refresh_token"))({error:failure}=await supabase.auth.setSession({access_token:hash.get("access_token")!,refresh_token:hash.get("refresh_token")!}));
      const{data}=await supabase.auth.getSession();
      if(!active)return;
      if(failure||!data.session){setSessionError("This password-reset link is invalid or expired. Request a new link.");return}
      window.history.replaceState({},"","/reset-password");setReady(true);
    };
    void prepare();return()=>{active=false};
  },[notice,router]);
  if(notice==="password_updated")return <p className="form-message success" role="status">Your password was updated successfully. Redirecting to sign in…</p>;
  if(sessionError)return <p className="form-message error" role="alert">{sessionError}</p>;
  if(!ready)return <p className="form-message" role="status">Verifying your secure recovery link…</p>;
  return <>{error&&<p className="form-message error" role="alert">{errors[error]||errors.update_failed}</p>}<form action="/api/auth/update-password" method="post"><label>New Password<PasswordInput autoComplete="new-password"/></label><label>Confirm Password<input required type="password" name="confirmPassword" autoComplete="new-password" minLength={8}/></label><CaptchaWidget/><button className="button">Update password</button></form></>;
}
