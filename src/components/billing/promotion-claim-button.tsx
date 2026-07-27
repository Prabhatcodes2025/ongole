"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";

export function PromotionClaimButton({propertyId,promotionType}:{propertyId:string;promotionType:"featured"|"verified"}){
  const router=useRouter();
  const[status,setStatus]=useState<"idle"|"loading"|"success"|"error">("idle");
  const[message,setMessage]=useState("");
  async function claim(){
    setStatus("loading");setMessage("");
    const response=await fetch("/api/promotions/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({propertyId,promotionType})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){setStatus("error");setMessage(result.error||"Activation failed.");return}
    setStatus("success");setMessage(`${promotionType==="featured"?"Featured":"Verified"} promotion activated.`);
    router.refresh();
  }
  return <div className="promotion-claim">
    <button className="button button-light" type="button" disabled={status==="loading"} onClick={claim}>{status==="loading"?"Activating…":`Use ${promotionType} allowance`}</button>
    {message?<p className={status==="error"?"form-error":"form-success"} role="status">{message}</p>:null}
  </div>;
}
