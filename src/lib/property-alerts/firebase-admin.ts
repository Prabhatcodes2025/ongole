import "server-only";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";

export function firebaseAdminConfigured(){return Boolean(process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY)}
export async function sendPropertyPush(input:{token:string;title:string;body:string;url:string;image?:string|null;propertyId?:string|null}){
  if(!firebaseAdminConfigured())return {ok:false,code:"not_configured"};
  const projectId=process.env.FIREBASE_PROJECT_ID!,clientEmail=process.env.FIREBASE_CLIENT_EMAIL!,privateKey=process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g,"\n");
  if(!getApps().length)initializeApp({credential:cert({projectId,clientEmail,privateKey})});
  try{
    await getMessaging().send({token:input.token,data:{title:input.title,body:input.body,url:input.url,image:input.image||"",propertyId:input.propertyId||""},webpush:{headers:{TTL:"3600"}}});
    return {ok:true,code:"sent"};
  }catch(error){const code=typeof error==="object"&&error!==null&&"code" in error?String(error.code):"unknown";return {ok:false,code};}
}
export function isInvalidFirebaseToken(code:string){return ["messaging/registration-token-not-registered","messaging/invalid-registration-token","messaging/invalid-argument"].includes(code)}
