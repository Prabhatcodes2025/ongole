"use client";

import Image from "next/image";
import {useRouter} from "next/navigation";
import {useState} from "react";

export type PropertyMediaItem={
  id:string;
  url:string;
  original_filename:string;
  is_cover:boolean;
  sort_order:number;
};

export function PropertyMediaManager({items,endpointBase,query=""}:{items:PropertyMediaItem[];endpointBase:string;query?:string}){
  const router=useRouter();
  const[media,setMedia]=useState(()=>ordered(items));
  const[busy,setBusy]=useState<string|null>(null);
  const[error,setError]=useState("");

  async function mutate(mediaId:string,action:"up"|"down"|"cover"|"remove"){
    if(busy)return;
    setBusy(`${mediaId}:${action}`);setError("");
    try{
      const response=await fetch(`${endpointBase}/${mediaId}${query}`,{
        method:action==="remove"?"DELETE":"PATCH",
        headers:{Accept:"application/json",...(action==="remove"?{}:{"Content-Type":"application/json"})},
        body:action==="remove"?undefined:JSON.stringify({action}),
      });
      const payload=await response.json().catch(()=>({})) as{error?:string};
      if(!response.ok)throw new Error(payload.error||"The image could not be updated.");
      setMedia(current=>applySuccessfulAction(current,mediaId,action));
      router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"The image could not be updated.")}
    finally{setBusy(null)}
  }

  if(!media.length)return <p>No images uploaded.</p>;
  return <>
    {error&&<p className="form-message error" role="alert">{error}</p>}
    <ul className="media-manager">{media.map((image,index)=><li key={image.id}>
      {image.url&&<Image src={image.url} width={150} height={100} alt={image.original_filename}/>}<div><strong>{image.original_filename}</strong><span>{image.is_cover?"Cover image":`Position ${index+1}`}</span></div>
      <div className="media-controls">
        {!image.is_cover&&<button type="button" disabled={Boolean(busy)} onClick={()=>mutate(image.id,"cover")}>Make cover</button>}
        <button type="button" disabled={Boolean(busy)||index===0} onClick={()=>mutate(image.id,"up")} aria-label={`Move ${image.original_filename} earlier`}>↑</button>
        <button type="button" disabled={Boolean(busy)||index===media.length-1} onClick={()=>mutate(image.id,"down")} aria-label={`Move ${image.original_filename} later`}>↓</button>
        <button type="button" disabled={Boolean(busy)} className="danger-link" onClick={()=>mutate(image.id,"remove")}>Remove</button>
      </div>
    </li>)}</ul>
  </>;
}

function ordered(items:PropertyMediaItem[]){return [...items].sort((a,b)=>a.sort_order-b.sort_order)}

export function applySuccessfulAction(items:PropertyMediaItem[],mediaId:string,action:"up"|"down"|"cover"|"remove"){
  const next=ordered(items);
  const index=next.findIndex(item=>item.id===mediaId);
  if(index<0)return next;
  if(action==="cover")return next.map(item=>({...item,is_cover:item.id===mediaId}));
  if(action==="remove"){
    const removed=next[index],remaining=next.filter(item=>item.id!==mediaId);
    if(removed.is_cover&&remaining.length&&!remaining.some(item=>item.is_cover))remaining[0]={...remaining[0],is_cover:true};
    return remaining.map((item,sort_order)=>({...item,sort_order}));
  }
  const other=action==="up"?index-1:index+1;
  if(other<0||other>=next.length)return next;
  [next[index],next[other]]=[next[other],next[index]];
  return next.map((item,sort_order)=>({...item,sort_order}));
}
