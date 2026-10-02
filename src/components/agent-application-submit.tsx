"use client";
import {FormEvent,useEffect,useState} from "react";
import {AGENT_DRAFT_KEY} from "@/src/components/agent-application-prefill";

type Values=Record<string,string>;
const fields=[ ["yearsExperience","Years of experience","number"],["workingTowns","Working towns","text"],["officeAddress","Office address","textarea"],["specializations","Specialisations","text"],["about","Professional introduction","textarea"] ] as const;
export function AgentApplicationSubmit({identity}:{identity:{name:string;mobile:string;email:string}}){
 const [values,setValues]=useState<Values>({}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{const timer=window.setTimeout(()=>{try{const parsed=JSON.parse(localStorage.getItem(AGENT_DRAFT_KEY)||"{}");setValues({name:parsed.name||identity.name,mobile:parsed.mobile||identity.mobile,email:parsed.email||identity.email,...parsed})}catch{setValues({name:identity.name,mobile:identity.mobile,email:identity.email})}setReady(true)},0);return()=>window.clearTimeout(timer)},[identity]);
 function update(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>){const next={...values,[event.target.name]:event.target.value};setValues(next);try{localStorage.setItem(AGENT_DRAFT_KEY,JSON.stringify(next))}catch{/* Keep form usable if storage is disabled. */}}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");try{const response=await fetch("/api/agents/application",{method:"POST",body:new FormData(event.currentTarget)});const result=await response.json().catch(()=>({}));if(!response.ok){setMessage(result.error||"The application could not be saved.");return}localStorage.removeItem(AGENT_DRAFT_KEY);setMessage("Your private application has been submitted for administrator review.")}catch{setMessage("The application could not be saved. Check your connection and try again.")}finally{setBusy(false)}}
 if(!ready)return <p role="status">Restoring your application…</p>;
 return <form className="submission-form compact-form agent-prefill-form" onSubmit={submit}>
  <label>Full Name<input required name="name" autoComplete="name" minLength={2} maxLength={100} value={values.name||""} onChange={update}/></label><label>Mobile Number<input required name="mobile" type="tel" autoComplete="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" value={values.mobile||""} onChange={update}/></label><label className="wide">Email Address<input required name="email" type="email" autoComplete="email" value={values.email||""} onChange={update}/></label>
  {fields.map(([name,label,type])=><label key={name} className={type==="textarea"?"wide":""}>{label}{name==="yearsExperience"&&<span> (optional)</span>}{type==="textarea"?<textarea name={name} rows={name==="about"?4:3} maxLength={name==="about"?1500:500} value={values[name]||""} onChange={update}/>:<input name={name} type={type} min={name==="yearsExperience"?0:undefined} max={name==="yearsExperience"?80:undefined} maxLength={name==="workingTowns"?300:name==="specializations"?500:undefined} value={values[name]||""} onChange={update}/>}</label>)}
  {message&&<p className="form-message wide" role="status">{message}</p>}<button className="button" disabled={busy}>{busy?"Submitting…":"Submit private application"}</button>
 </form>
}
