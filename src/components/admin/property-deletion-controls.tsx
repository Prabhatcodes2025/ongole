"use client";

import {useRef} from "react";

export function PropertyDeletionControls({id,reference,title,deleted=false,allowPermanent=false,compact=false}:{id:string;reference:string;title:string;deleted?:boolean;allowPermanent?:boolean;compact?:boolean}){
  const lifecycleDialog=useRef<HTMLDialogElement>(null),permanentDialog=useRef<HTMLDialogElement>(null);
  const action=deleted?"restore":"soft_delete";
  return <div className={compact?"property-delete-controls compact":"property-delete-controls"}>
    <button className={deleted?"button button-light":"danger-button"} type="button" onClick={()=>lifecycleDialog.current?.showModal()}>{deleted?"Restore":"Delete property"}</button>
    <dialog ref={lifecycleDialog} aria-labelledby={`property-lifecycle-${id}`}>
      <form method="dialog"><button className="dialog-close" aria-label="Close confirmation">×</button></form>
      <h2 id={`property-lifecycle-${id}`}>{deleted?"Restore property":"Delete property"}</h2>
      <p><strong>{reference}</strong><br/>{title}</p>
      <p>{deleted?"The property will return as a private draft and require review before publication.":"This safely archives the property. Public pages and active Admin counts will no longer include it, and it can be restored."}</p>
      <form className="stack-form" action={`/api/admin/properties/${id}/deletion`} method="post">
        <input type="hidden" name="action" value={action}/>
        <label>Type <strong>{reference}</strong> to confirm<input required name="confirmation" autoComplete="off"/></label>
        <button className={deleted?"button":"danger-button"}>{deleted?"Restore property":"Archive property"}</button>
      </form>
    </dialog>
    {allowPermanent&&deleted&&<><button className="danger-link" type="button" onClick={()=>permanentDialog.current?.showModal()}>Permanent deletion</button><dialog ref={permanentDialog} aria-labelledby={`property-permanent-${id}`}>
      <form method="dialog"><button className="dialog-close" aria-label="Close permanent deletion confirmation">×</button></form>
      <h2 id={`property-permanent-${id}`}>Permanently delete property</h2>
      <p><strong>{reference}</strong><br/>{title}</p>
      <p>This super-administrator action cannot be undone. It is refused when enquiries, payments, promotion history or posting-retention records depend on the property.</p>
      <form className="stack-form" action={`/api/admin/properties/${id}/deletion`} method="post">
        <input type="hidden" name="action" value="permanent_delete"/>
        <label>Type <strong>DELETE {reference}</strong> to confirm<input required name="confirmation" autoComplete="off"/></label>
        <button className="danger-button">Permanently delete</button>
      </form>
    </dialog></>}
  </div>;
}
