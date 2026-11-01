"use client";

import {FormEvent,useRef,useState} from "react";
import {PendingSubmitButton} from "@/src/components/pending-submit-button";

type Props={id:string;reference:string;title:string;deleted?:boolean;allowPermanent?:boolean;compact?:boolean;actionUrl?:string};

export function PropertyDeletionControls({id,reference,title,deleted=false,allowPermanent=false,compact=false,actionUrl}:Props){
  const lifecycleDialog=useRef<HTMLDialogElement>(null),permanentDialog=useRef<HTMLDialogElement>(null);
  const [confirmation,setConfirmation]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const action=deleted?"restore":"soft_delete",endpoint=actionUrl||`/api/admin/properties/${id}/deletion`,expected=`DELETE ${reference}`;

  async function submitPermanent(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(confirmation!==expected)return;
    setBusy(true);setMessage("");
    try{
      const response=await fetch(endpoint,{method:"POST",body:new FormData(event.currentTarget),credentials:"same-origin",headers:{Accept:"application/json"}});
      if(response.ok){const result=await response.json().catch(()=>null) as {physicallyDeleted?:boolean}|null;if(!result?.physicallyDeleted){setMessage("The server response did not confirm physical deletion.");return}setMessage("The listing was permanently deleted and verified absent.");window.location.assign(actionUrl?"/admin/pg":"/admin/properties");return}
      const result=await response.json().catch(()=>null) as {error?:string}|null;
      setMessage(result?.error||"Permanent deletion failed. The record was not changed.");
    }catch{setMessage("Permanent deletion could not be completed. Check the connection and try again.")}
    finally{setBusy(false)}
  }

  return <div className={compact?"property-delete-controls compact":"property-delete-controls"}>
    <button className={deleted?"button button-light":"danger-button"} type="button" onClick={()=>lifecycleDialog.current?.showModal()}>{deleted?"Restore":"Soft Delete"}</button>
    <dialog ref={lifecycleDialog} aria-labelledby={`property-lifecycle-${id}`}>
      <form method="dialog"><button className="dialog-close" aria-label="Close confirmation">×</button></form>
      <h2 id={`property-lifecycle-${id}`}>{deleted?"Restore listing":"Soft Delete listing"}</h2>
      <p><strong>{title}</strong><br/>{reference}</p>
      <p>{deleted?"The listing will return as a private draft and require review before publication.":"This marks the listing deleted and archives it. Public pages and active Admin counts will no longer include it, and it can be restored. The bulk Archive action changes status only."}</p>
      <form className="stack-form" action={endpoint} method="post">
        <input type="hidden" name="action" value={action}/>
        <label>Type <strong>{reference}</strong> to confirm exactly<input required name="confirmation" autoComplete="off" spellCheck={false}/></label>
        <PendingSubmitButton className={deleted?"button":"danger-button"} pendingText={deleted?"Restoring…":"Soft deleting…"}>{deleted?"Restore":"Soft Delete"}</PendingSubmitButton>
      </form>
    </dialog>
    {allowPermanent?<><button className="danger-button permanent-delete-button" type="button" onClick={()=>{setConfirmation("");setMessage("");permanentDialog.current?.showModal()}}>Permanently Delete</button><dialog ref={permanentDialog} aria-labelledby={`property-permanent-${id}`}>
      <form method="dialog"><button className="dialog-close" aria-label="Close permanent deletion confirmation">×</button></form>
      <h2 id={`property-permanent-${id}`}>Permanently Delete</h2>
      <p><strong>{title}</strong><br/>Reference: <strong>{reference}</strong></p>
      <p>This action is irreversible. The server will refuse it unless the listing is soft-deleted and no enquiries, payment orders, or promotion history depend on it. Posting-usage and audit ledgers are preserved separately.</p>
      {!deleted&&<p className="form-message" role="status">Soft Delete this listing first. You may still submit to see the server safety response.</p>}
      <form className="stack-form" action={endpoint} method="post" onSubmit={submitPermanent} aria-busy={busy}>
        <input type="hidden" name="action" value="permanent_delete"/>
        <label>Type <strong>{expected}</strong> exactly<input required name="confirmation" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" spellCheck={false}/></label>
        {message&&<p className={message.includes("permanently deleted")?"form-message":"form-message error"} role="alert">{message}</p>}
        <button className="danger-button" disabled={confirmation!==expected||busy} aria-busy={busy}>{busy&&<i className="pending-spinner" aria-hidden="true"/>}{busy?"Deleting…":"Permanently Delete"}</button>
      </form>
    </dialog></>:<div className="permanent-delete-denied"><button className="danger-button" type="button" disabled aria-describedby={`permanent-permission-${id}`}>Permanently Delete</button><small id={`permanent-permission-${id}`}>Super Administrator permission required.</small></div>}
  </div>;
}
