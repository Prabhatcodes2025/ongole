"use client";

import {ReactNode,useRef,useState} from "react";
import {useRouter} from "next/navigation";

type BulkResult={id:string;reference?:string;ok:boolean;error?:string;code?:string};
type SelectedItem={id:string;reference:string;title:string;deleted:boolean};
type Props={endpoint:string;actions:readonly (readonly [string,string])[];children:ReactNode;entityLabel:string};

export function BulkActionControls({endpoint,actions,children,entityLabel}:Props){
  const form=useRef<HTMLDivElement>(null),router=useRouter();
  const [selected,setSelected]=useState(0),[action,setAction]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failures,setFailures]=useState<BulkResult[]>([]),[permanentItems,setPermanentItems]=useState<SelectedItem[]|null>(null),[confirmations,setConfirmations]=useState<Record<string,string>>({});
  const boxes=()=>Array.from(form.current?.querySelectorAll<HTMLInputElement>('input[data-bulk-id="true"]')||[]);
  const recount=()=>setSelected(boxes().filter(box=>box.checked).length);
  const chooseAll=(checked:boolean)=>{for(const box of boxes())box.checked=checked;recount()};

  const selectedItems=()=>boxes().filter(box=>box.checked).map(box=>({id:box.value,reference:box.dataset.reference||box.value,title:box.dataset.title||box.dataset.reference||box.value,deleted:box.dataset.deleted==="true"}));
  async function execute(ids:string[],extra:Record<string,unknown>={}){
    setBusy(true);setMessage("");setFailures([]);
    try{
      const response=await fetch(endpoint,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({action,ids,confirmation:action.toUpperCase(),...extra})});
      const result=await response.json().catch(()=>null) as {error?:string;results?:BulkResult[];succeeded?:number;failed?:number}|null;
      if(!response.ok&&!result?.results){setMessage(result?.error||"The bulk action failed. No success response was returned.");return}
      const failed=(result?.results||[]).filter(item=>!item.ok);
      setFailures(failed);setMessage(`${result?.succeeded||0} physically deleted or updated${failed.length?`; ${failed.length} failed.`:"."}`);
      for(const box of boxes())box.checked=false;setSelected(0);setPermanentItems(null);setConfirmations({});router.refresh();
    }catch{setMessage("The bulk action could not reach the server. No success was assumed.")}
    finally{setBusy(false)}
  }
  async function submit(){
    const items=selectedItems(),ids=items.map(item=>item.id);
    if(!action||ids.length===0){setMessage(`Select at least one ${entityLabel} and an action.`);return}
    if(action==="permanent_delete"){setPermanentItems(items);setConfirmations({});return}
    const label=actions.find(([value])=>value===action)?.[1]||action;
    if(!window.confirm(`${label} ${ids.length} selected ${entityLabel}${ids.length===1?"":"s"}?`))return;
    await execute(ids);
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
    {failures.length>0&&<ul className="bulk-failures" role="alert">{failures.map(item=><li key={item.id}><strong>{item.reference||item.id}</strong>: {item.error}{item.code?` (${item.code})`:""}</li>)}</ul>}
    {permanentItems&&<dialog open aria-labelledby="bulk-permanent-title"><h2 id="bulk-permanent-title">Permanently Delete {permanentItems.length} properties</h2><p>This is irreversible. Every record is checked independently for Super Administrator authorization, archive status, retained dependencies, and physical database absence.</p><ul>{permanentItems.map(item=><li key={item.id}><strong>{item.title}</strong> ({item.reference}) — {item.deleted?"Archived and ready for dependency checks.":"Not eligible: use the row Archive action first."}</li>)}</ul>{permanentItems.map(item=>item.deleted&&<label key={item.id}>Type <strong>DELETE {item.reference}</strong> exactly<input value={confirmations[item.id]||""} onChange={event=>setConfirmations(current=>({...current,[item.id]:event.target.value}))} autoComplete="off" spellCheck={false}/></label>)}<div className="button-row"><button type="button" className="button button-light" onClick={()=>{setPermanentItems(null);setConfirmations({})}} disabled={busy}>Cancel</button><button type="button" className="danger-button" disabled={busy||permanentItems.some(item=>!item.deleted||confirmations[item.id]!==`DELETE ${item.reference}`)} onClick={()=>execute(permanentItems.map(item=>item.id),{confirmations})}>{busy?"Verifying deletion…":"Permanently Delete and Verify"}</button></div></dialog>}
    {children}
  </div>;
}
