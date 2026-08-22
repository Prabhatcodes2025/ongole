"use client";

import { useState } from "react";
import { CaptchaWidget } from "@/src/components/captcha-widget";
import { PasswordInput } from "@/src/components/password-input";
import {registrationFieldMessages,type RegistrationField,validateRegistrationFields} from "@/src/lib/auth/registration";

const accountTypes = [
  ["buyer", "Buyer"],
  ["owner", "Property owner"],
  ["agent", "Real estate agent"],
  ["pg_owner", "PG owner / manager"],
] as const;

export function RegistrationForm({ initialAccountType, returnTo,serverErrorFields=[] }: { initialAccountType: string; returnTo: string;serverErrorFields?:RegistrationField[] }) {
  const [accountType, setAccountType] = useState(initialAccountType);
  const [errors,setErrors]=useState<Partial<Record<RegistrationField,string>>>(()=>Object.fromEntries(serverErrorFields.map(field=>[field,registrationFieldMessages[field]])));
  const isAgent = accountType === "agent";
  const accountLabel=accountTypes.find(([value])=>value===accountType)?.[1]||"User";
  const error=(field:RegistrationField)=>errors[field]?<small className="field-error" id={`${field}-error`} role="alert">{errors[field]}</small>:null;
  const describedBy=(field:RegistrationField,help?:string)=>[help,errors[field]?`${field}-error`:null].filter(Boolean).join(" ")||undefined;
  return <>
    <label>Register as<select name="oauthAccountType" value={accountType} onChange={(event)=>{setAccountType(event.target.value);setErrors(current=>({...current,accountType:undefined}))}} aria-invalid={Boolean(errors.accountType)||undefined} aria-describedby={describedBy("accountType")}><option value="buyer">Buyer</option><option value="owner">Property owner</option><option value="agent">Real estate agent</option><option value="pg_owner">PG owner / manager</option></select>{error("accountType")}</label>
    <form className="oauth-form" action="/api/auth/google" method="post"><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="accountType" value={accountType}/><label className="consent auth-consent"><input required type="checkbox" name="termsAccepted" value="accepted"/><span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.</span></label><button className="button button-light" type="submit">Continue with Google as {accountLabel}</button></form>
    <div className="auth-divider"><span>or register with email</span></div>
  <form action="/api/auth/register" method="post" noValidate onSubmit={(event)=>{const values=Object.fromEntries(new FormData(event.currentTarget));const next=validateRegistrationFields(values);if(Object.keys(next).length){event.preventDefault();setErrors(next);const first=Object.keys(next)[0];event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()}else setErrors({})}}>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <label>Full name<input required name="name" autoComplete="name" minLength={2} maxLength={100} aria-invalid={Boolean(errors.name)||undefined} aria-describedby={describedBy("name")}/>{error("name")}</label>
    <label>Mobile number<input required type="tel" name="mobile" autoComplete="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" aria-invalid={Boolean(errors.mobile)||undefined} aria-describedby={describedBy("mobile","mobile-help")}/><small id="mobile-help">Enter a unique 10-digit Indian mobile number.</small>{error("mobile")}</label>
    <label>Email<input required type="email" name="email" autoComplete="email" autoCapitalize="none" aria-invalid={Boolean(errors.email)||undefined} aria-describedby={describedBy("email")}/>{error("email")}</label>
    <input type="hidden" name="accountType" value={accountType}/>
    {isAgent&&<fieldset className="agent-registration-fields"><legend>Professional profile</legend><label>Years of experience <span>(optional)</span><input name="yearsExperience" type="number" min="0" max="80" inputMode="numeric" aria-invalid={Boolean(errors.yearsExperience)||undefined} aria-describedby={describedBy("yearsExperience")}/>{error("yearsExperience")}</label><label>Office address <span>(optional)</span><textarea name="officeAddress" rows={3} maxLength={500}/></label><label>Working towns <span>(up to five, comma separated)</span><input name="workingTowns" maxLength={300} placeholder="Ongole, Chirala"/></label><label>Specialisations <span>(comma separated)</span><input name="specializations" maxLength={500} placeholder="Residential, Commercial, Agricultural"/></label><label>Professional introduction <span>(optional)</span><textarea name="about" rows={4} maxLength={1500}/></label><p className="form-note">Your profile remains pending and is not shown publicly until administrator review and approval.</p></fieldset>}
    <label>Password<PasswordInput autoComplete="new-password" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}" describedBy={describedBy("password","password-help")} invalid={Boolean(errors.password)}/><small id="password-help">Use at least 8 characters with uppercase, lowercase, a number and a special character.</small>{error("password")}</label>
    <label className="consent auth-consent"><input required type="checkbox" name="termsAccepted" value="accepted" aria-invalid={Boolean(errors.termsAccepted)||undefined} aria-describedby={describedBy("termsAccepted")}/> <span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> of OngoleProperty.com.</span>{error("termsAccepted")}</label>
    <CaptchaWidget/>
    <button className="button" type="submit">Create account</button>
  </form>
  </>
}
