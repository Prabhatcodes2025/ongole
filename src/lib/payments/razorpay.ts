import {createHash,createHmac,timingSafeEqual} from "node:crypto";

export function verifyRazorpayWebhookSignature(rawBody:string,signature:string,secret:string){
  if(!rawBody||!signature||!secret)return false;
  const expected=createHmac("sha256",secret).update(rawBody).digest("hex");
  const left=Buffer.from(expected,"utf8"),right=Buffer.from(signature,"utf8");
  return left.length===right.length&&timingSafeEqual(left,right);
}
export function paymentPayloadHash(rawBody:string){return createHash("sha256").update(rawBody).digest("hex")}
export function signatureHash(signature:string){return createHash("sha256").update(signature).digest("hex")}

export async function createRazorpayOrder({keyId,keySecret,amount,currency,receipt,notes}:{keyId:string;keySecret:string;amount:number;currency:string;receipt:string;notes:Record<string,string>}){
  const response=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,"Content-Type":"application/json"},body:JSON.stringify({amount:Math.round(amount*100),currency,receipt,notes}),cache:"no-store"});
  const result=await response.json() as {id?:string;amount?:number;currency?:string;status?:string;error?:{description?:string}};
  if(!response.ok||!result.id)throw new Error(result.error?.description||"Provider order creation failed.");
  return{id:result.id,amount:Number(result.amount||0),currency:String(result.currency||currency),status:String(result.status||"created")};
}
