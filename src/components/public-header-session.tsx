"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {AccountMenu} from "@/src/components/account-menu";
import {PublicNavigation} from "@/src/components/public-navigation";

type AuthContext={display_name?:unknown};

export function PublicHeaderSession(){
  const[account,setAccount]=useState<{name:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/auth/context",{credentials:"same-origin",cache:"no-store",headers:{accept:"application/json"},signal:controller.signal})
      .then(async response=>response.ok?await response.json() as AuthContext:null)
      .then(context=>{if(typeof context?.display_name==="string"&&context.display_name.trim())setAccount({name:context.display_name})})
      .catch(()=>{});
    return()=>controller.abort();
  },[]);
  return <><PublicNavigation account={account}/><div className="nav-actions">{account?<AccountMenu className="public-profile-menu" name={account.name} showDashboard/>:<><Link className="text-link" href="/login">Sign in</Link><Link className="button button-small" href="/post-property?transaction=sale">Post property</Link></>}</div></>;
}
