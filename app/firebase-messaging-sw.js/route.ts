import {NextResponse} from "next/server";
import {firebaseWebConfig} from "@/src/lib/property-alerts/firebase-web";

export function GET(){
  // All interpolated values are public Firebase web-app identifiers, JSON-escaped.
  const script=`importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js','https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(firebaseWebConfig)});
const messaging=firebase.messaging();
const safePath=value=>typeof value==='string'&&(/^(\\/(property|paying-guest)\\/[a-zA-Z0-9-]+|\\/properties)$/.test(value))?value:null;
messaging.onBackgroundMessage(payload=>{
  const data=payload.data||{};const path=safePath(data.url);if(!path)return;
  self.registration.showNotification(String(data.title||'New property alert').slice(0,120),{body:String(data.body||'').slice(0,240),icon:'/ongole-property-logo.png',image:data.image&&data.image.startsWith(self.location.origin+'/')?data.image:undefined,data:{url:path},tag:'ongole-property-'+String(data.propertyId||path)});
});
self.addEventListener('notificationclick',event=>{event.notification.close();const path=safePath(event.notification.data&&event.notification.data.url);if(!path)return;const target=new URL(path,self.location.origin).href;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(all=>{const existing=all.find(client=>client.url===target);return existing?existing.focus():clients.openWindow(target)}));});`;
  return new NextResponse(script,{headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-store","Service-Worker-Allowed":"/","X-Content-Type-Options":"nosniff"}});
}
