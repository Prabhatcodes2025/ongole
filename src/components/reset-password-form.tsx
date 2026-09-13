"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {CaptchaWidget} from "@/src/components/captcha-widget";
import {PasswordInput} from "@/src/components/password-input";
import {createSupabaseBrowserClient} from "@/src/lib/supabase/browser";

const errors:Record<string,string>={invalid_link:"This password-reset link is invalid or expired. Request a new link.",invalid_password:"Enter a password with at least eight characters.",password_mismatch:"The passwords do not match.",update_failed:"The password could not be updated. Request a new reset link and try again."};

export function ResetPasswordForm({error,notice}:{error?:string;notice?:string}){
  const router=useRouter();const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);const[ready,setReady]=useState(false);const[sessionError,setSessionError]=useState(configured?"":"Password recovery is not configured.");
  useEffect(()=>{
    if(notice==="password_updated"){const timer=window.setTimeout(()=>router.replace("/login?notice=password_updated"),1600);return()=>window.clearTimeout(timer)}
    if(error==="invalid_link")return;
    const supabase=createSupabaseBrowserClient();if(!supabase)return;
    let active=true;
    const prepare=async()=>{
      const{data}=await supabase.auth.getSession();
      if(!active)return;
      if(!data.session){setSessionError(errors.invalid_link);return}
      setReady(true);
    };
    void prepare();return()=>{active=false};
  },[error,notice,router]);
  if(notice==="password_updated")return <p className="form-message success" role="status">Your password was updated successfully. Redirecting to sign in…</p>;
  if(error==="invalid_link")return <p className="form-message error" role="alert">{errors.invalid_link}</p>;
  if(sessionError)return <p className="form-message error" role="alert">{sessionError}</p>;
  if(!ready)return <p className="form-message" role="status">Verifying your secure recovery link…</p>;
  return <>{error&&<p className="form-message error" role="alert">{errors[error]||errors.update_failed}</p>}<form action="/api/auth/update-password" method="post"><label>New Password<PasswordInput autoComplete="new-password"/></label><label>Confirm Password<input required type="password" name="confirmPassword" autoComplete="new-password" minLength={8}/></label><CaptchaWidget/><button className="button">Update password</button></form></>;
}
