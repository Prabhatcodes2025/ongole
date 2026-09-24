"use client";

import {FormEvent,useState} from "react";

export const AGENT_DRAFT_KEY="ongoleproperty.pending-agent-application";

export function AgentApplicationPrefill(){
  const[message,setMessage]=useState("");
  function continueToAccount(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form).entries());try{localStorage.setItem(AGENT_DRAFT_KEY,JSON.stringify(values));window.location.assign("/register?accountType=agent&returnTo=%2Fdashboard")}catch{setMessage("This browser could not retain the application. Please enable local storage and try again.")}}
  return <form className="submission-form compact-form agent-prefill-form" onSubmit={continueToAccount}><label>Years of experience <span>(optional)</span><input name="yearsExperience" type="number" min="0" max="80" inputMode="numeric"/></label><label>Working towns <span>(up to five, comma separated)</span><input name="workingTowns" maxLength={300} placeholder="Ongole, Chirala"/></label><label className="wide">Office address <span>(optional)</span><textarea name="officeAddress" rows={3} maxLength={500}/></label><label className="wide">Specialisations <span>(comma separated)</span><input name="specializations" maxLength={500} placeholder="Residential, Commercial, Agricultural"/></label><label className="wide">Professional introduction <span>(optional)</span><textarea name="about" rows={4} maxLength={1500}/></label>{message&&<p className="form-message error wide" role="alert">{message}</p>}<button className="button" type="submit">Continue to Sign In / Register</button><p className="form-note wide">Your application stays in this browser until the final account step. Nothing is written to the protected database anonymously.</p></form>
}
