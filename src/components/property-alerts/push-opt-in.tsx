"use client";
import {useEffect,useState} from "react";
import {firebaseVapidKey,firebaseWebConfig,firebaseWebConfigured} from "@/src/lib/property-alerts/firebase-web";

type State="default"|"granted"|"denied"|"unsupported"|"revoked";
let foregroundUnsubscribe:(()=>void)|undefined;
function getDeviceId(){const key="ongoleproperty-push-device";let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}return id;}
async function updateRegistration(body:Record<string,unknown>){const response=await fetch("/api/property-alerts/registration",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!response.ok)throw new Error("registration_failed");}
export function PushOptIn({enabled,status}:{enabled:boolean;status:string}){
  const [state,setState]=useState<State>(["granted","denied","unsupported","revoked"].includes(status)?status as State:"default");
  const [active,setActive]=useState(enabled);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  useEffect(()=>{queueMicrotask(()=>{if(!("Notification" in window)||!("serviceWorker" in navigator)){setState("unsupported");return}if(Notification.permission==="denied")setState("denied");else if(Notification.permission==="granted")setState("granted");else if(active){setState("revoked");setActive(false);void updateRegistration({action:"disable",deviceId:getDeviceId(),permissionStatus:"revoked"}).catch(()=>{})}});},[active]);
  async function enable(){if(busy)return;setBusy(true);setMessage("");try{
    if(!firebaseWebConfigured()){setMessage("Property alerts are not configured yet. Please try again later.");return}
    if(!("Notification" in window)||!("serviceWorker" in navigator)){setState("unsupported");await updateRegistration({action:"status",permissionStatus:"unsupported"});return}
    if(Notification.permission==="denied"){setState("denied");await updateRegistration({action:"status",permissionStatus:"denied"});return}
    const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
    if(permission!=="granted"){setState("denied");await updateRegistration({action:"status",permissionStatus:"denied"});return}
    const [{initializeApp,getApps},{getMessaging,getToken,isSupported,onMessage}]=await Promise.all([import("firebase/app"),import("firebase/messaging")]);
    if(!await isSupported()){setState("unsupported");await updateRegistration({action:"status",permissionStatus:"unsupported"});return}
    const app=getApps().length?getApps()[0]:initializeApp(firebaseWebConfig);
    const registration=await navigator.serviceWorker.register("/firebase-messaging-sw.js",{scope:"/"});
    const messaging=getMessaging(app);const token=await getToken(messaging,{vapidKey:firebaseVapidKey,serviceWorkerRegistration:registration});
    if(!token)throw new Error("token_unavailable");
    await updateRegistration({action:"enable",deviceId:getDeviceId(),token});
    foregroundUnsubscribe?.();foregroundUnsubscribe=onMessage(messaging,payload=>{const title=payload.data?.title||"New property alert";const url=payload.data?.url;if(url&&(/^(\/(property|paying-guest)\/[a-zA-Z0-9-]+|\/properties)$/.test(url)))void registration.showNotification(title,{body:payload.data?.body||"",icon:"/favicon.ico",data:{url}})});
    setActive(true);setState("granted");setMessage("Property alerts are enabled on this browser.");
  }catch{setMessage("Could not enable notifications. Please try again later.")}finally{setBusy(false)}}
  async function disable(){setBusy(true);setMessage("");try{await updateRegistration({action:"disable",deviceId:getDeviceId(),permissionStatus:"revoked"});setActive(false);setState("revoked");foregroundUnsubscribe?.();foregroundUnsubscribe=undefined;setMessage("Property alerts are disabled.")}catch{setMessage("Could not disable notifications. Please try again later.")}finally{setBusy(false)}}
  return <section className="dashboard-card"><h2>Never Miss a Property</h2><p>Get alerts when a newly published property matches your saved requirements.</p>
    {state==="unsupported"?<p>Web push is not supported in this browser.</p>:state==="denied"?<p>Notifications are blocked in your browser settings. Allow them there to enable property alerts.</p>:active?<button type="button" className="button" disabled={busy} onClick={disable}>Disable property alerts</button>:<button type="button" className="button" disabled={busy} onClick={enable}>ENABLE PROPERTY ALERTS</button>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
