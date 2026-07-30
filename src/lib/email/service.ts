import nodemailer from "nodemailer";
import {env} from "@/src/lib/env";
import {emailTemplate,type EmailTemplate} from "@/src/lib/email/templates";
import {logEvent} from "@/src/lib/observability/logger";

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]||character));

export function isEmailConfigured(){return Boolean(env.smtp.host&&env.smtp.user&&env.smtp.password&&env.smtp.from)}

function transport(){
  return nodemailer.createTransport({
    host:env.smtp.host,
    port:env.smtp.port,
    secure:env.smtp.port===465,
    auth:{user:env.smtp.user,pass:env.smtp.password},
  });
}

export async function sendTemplateEmail(to:string|undefined|null,template:EmailTemplate,data:Record<string,string>){
  if(!to||!isEmailConfigured()){
    logEvent("warn","email.delivery_skipped",{template,reason:!to?"recipient_missing":"smtp_disabled"});
    return{sent:false,disabled:true};
  }
  try{
    const content=emailTemplate(template,data);
    await transport().sendMail({from:env.smtp.from,to,subject:content.subject,text:content.text,html:content.html});
    return{sent:true,disabled:false};
  }catch{
    logEvent("error","email.delivery_failed",{template});
    return{sent:false,disabled:false};
  }
}

export async function sendNotificationEmail(to:string|undefined|null,subject:string,body:string){
  if(!to||!isEmailConfigured()){
    logEvent("warn","email.delivery_skipped",{template:"notification",reason:!to?"recipient_missing":"smtp_disabled"});
    return{sent:false,disabled:true};
  }
  try{
    const safeSubject=subject.trim().slice(0,180);
    const safeBody=escapeHtml(body.trim().slice(0,4000)).replace(/\r?\n/g,"<br>");
    const html=`<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17211d"><div style="max-width:620px;margin:auto;padding:32px"><p style="color:#c96845;font-weight:700">ONGOLEPROPERTY.COM</p><h1>${escapeHtml(safeSubject)}</h1><p>${safeBody}</p><hr><p style="color:#66736d;font-size:12px">Kosana Associates LLP · Ongole, Prakasam District</p></div></body></html>`;
    await transport().sendMail({from:env.smtp.from,to,subject:safeSubject,text:body.trim().slice(0,4000),html});
    return{sent:true,disabled:false};
  }catch{
    logEvent("error","email.delivery_failed",{template:"notification"});
    return{sent:false,disabled:false};
  }
}
