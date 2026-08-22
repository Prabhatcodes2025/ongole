"use client";

import {useEffect} from "react";

export function NumericInputGuard(){
  useEffect(()=>{
    const preventWheelChange=(event:WheelEvent)=>{const target=event.target;if(target instanceof HTMLInputElement&&target.type==="number"&&document.activeElement===target)target.blur()};
    document.addEventListener("wheel",preventWheelChange,{passive:true});
    return()=>document.removeEventListener("wheel",preventWheelChange);
  },[]);
  return null;
}
