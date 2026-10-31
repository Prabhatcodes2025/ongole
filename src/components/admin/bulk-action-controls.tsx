"use client";

import {ReactNode,useRef,useState} from "react";
import {useRouter} from "next/navigation";

type BulkResult={id:string;reference?:string;ok:boolean;error?:string};
type Props={endpoint:string;actions:readonly (readonly [string,string])[];children:ReactNode;entityLabel:string};

export function BulkActionControls({endpoint,actions,children,entityLabel}:Props){
  const form=useRef<HTMLDivElement>(null),router=useRouter();
  const [selected,setSelected]=useState(0),[action,setAction]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failures,setFailures]=useState<BulkResult[]>([]);
  const boxes=()=>Array.from(form.current?.querySelectorAll<HTMLInputElement>('input[data-bulk-id="true"]')||[]);
  const recount=()=>setSelected(boxes().filter(box=>box.checked).length);
  const chooseAll=(checked:boolean)=>{for(const box of boxes())box.checked=checked;recount()};

  async function submit(){
    const ids=boxes().filter(box=>box.checked).map(box=>box.value);
    if(!action||ids.length===0){setMessage(`Select at least one ${entityLabel} and an action.`);return}
    const label=actions.find(([value])=>value===action)?.[1]||action;
    if(!window.confirm(`${label} ${ids.length} selected ${entityLabel}${ids.length===1?"":"s"}?`))return;
    setBusy(true);setMessage("");setFailures([]);
    try{
      const response=await fetch(endpoint,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({action,ids,confirmation:action.toUpperCase()})});
      const result=await response.json().catch(()=>null) as {error?:string;results?:BulkResult[];succeeded?:number;failed?:number}|null;
      if(!response.ok&&!result?.results){setMessage(result?.error||"The bulk action failed. No success response was returned.");return}
      const failed=(result?.results||[]).filter(item=>!item.ok);
      setFailures(failed);setMessage(`${result?.succeeded||0} succeeded${failed.length?`; ${failed.length} failed.`:"."}`);
      for(const box of boxes())box.checked=false;setSelected(0);router.refresh();
    }catch{setMessage("The bulk action could not reach the server. No success was assumed.")}
    finally{setBusy(false)}
  }

  return <div ref={form} className="admin-bulk-action-form" onChange={recount}>
    <div className="bulk-toolbar" role="group" aria-label={`${entityLabel} bulk actions`}>
      <button type="button" className="button button-light button-small" onClick={()=>chooseAll(true)}>Select All</button>
      <button type="button" className="button button-light button-small" onClick={()=>chooseAll(false)} disabled={!selected}>Deselect All</button>
      <strong aria-live="polite">{selected} selected</strong>
      <select required value={action} onChange={event=>setAction(event.target.value)} aria-label="Bulk action"><option value="" disabled>Bulk action</option>{actions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
      <button type="button" onClick={submit} className="button button-small" disabled={busy||!selected||!action}>{busy?"Applying…":"Apply"}</button>
    </div>
    {message&&<p className={failures.length?"form-message error":"form-message"} role="status" aria-live="polite">{message}</p>}
    {failures.length>0&&<ul className="bulk-failures" role="alert">{failures.map(item=><li key={item.id}><strong>{item.reference||item.id}</strong>: {item.error}</li>)}</ul>}
    {children}
  </div>;
}
