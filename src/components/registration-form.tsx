"use client";

import { useState } from "react";
import { CaptchaWidget } from "@/src/components/captcha-widget";
import { PasswordInput } from "@/src/components/password-input";

const accountTypes = [
  ["buyer", "Buyer"],
  ["owner", "Property owner"],
  ["agent", "Real estate agent"],
  ["pg_owner", "PG owner / manager"],
] as const;

export function RegistrationForm({ initialAccountType, returnTo }: { initialAccountType: string; returnTo: string }) {
  const [accountType, setAccountType] = useState(initialAccountType);
  const isAgent = accountType === "agent";
  return <form action="/api/auth/register" method="post">
    <input type="hidden" name="returnTo" value={returnTo}/>
    <label>Full name<input required name="name" autoComplete="name" minLength={2} maxLength={100}/></label>
    <label>Mobile number<input required type="tel" name="mobile" autoComplete="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" aria-describedby="mobile-help"/><small id="mobile-help">Enter a unique 10-digit Indian mobile number.</small></label>
    <label>Email<input required type="email" name="email" autoComplete="email" autoCapitalize="none"/></label>
    <label>Account type<select name="accountType" value={accountType} onChange={(event)=>setAccountType(event.target.value)}>{accountTypes.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    {isAgent&&<fieldset className="agent-registration-fields"><legend>Professional profile</legend><label>Years of experience <span>(optional)</span><input name="yearsExperience" type="number" min="0" max="80" inputMode="numeric"/></label><label>Office address <span>(optional)</span><textarea name="officeAddress" rows={3} maxLength={500}/></label><label>Working towns <span>(up to five, comma separated)</span><input name="workingTowns" maxLength={300} placeholder="Ongole, Chirala"/></label><label>Specialisations <span>(comma separated)</span><input name="specializations" maxLength={500} placeholder="Residential, Commercial, Agricultural"/></label><label>Professional introduction <span>(optional)</span><textarea name="about" rows={4} maxLength={1500}/></label><p className="form-note">Your profile remains pending and is not shown publicly until administrator review and approval.</p></fieldset>}
    <label>Password<PasswordInput autoComplete="new-password" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}" describedBy="password-help"/><small id="password-help">Use at least 8 characters with uppercase, lowercase, a number and a special character.</small></label>
    <label className="consent auth-consent"><input required type="checkbox" name="termsAccepted" value="accepted"/> <span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noreferrer">Terms &amp; Conditions</a> of OngoleProperty.com.</span></label>
    <CaptchaWidget/>
    <button className="button" type="submit">Create account</button>
  </form>;
}
