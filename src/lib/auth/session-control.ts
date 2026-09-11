import type {NextResponse} from "next/server";

export const SESSION_START_COOKIE="op-session-start",SESSION_ACTIVITY_COOKIE="op-session-activity",SESSION_KEEP_COOKIE="op-session-keep";
export const IDLE_TIMEOUT_MS=30*60*1000,ABSOLUTE_TIMEOUT_MS=24*60*60*1000;
const options={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};

export function setSessionControlCookies(response:NextResponse,keepSignedIn:boolean,now=Date.now()){
  const persistence=keepSignedIn?{maxAge:Math.floor(ABSOLUTE_TIMEOUT_MS/1000)}:{};
  response.cookies.set(SESSION_START_COOKIE,String(now),{...options,...persistence});response.cookies.set(SESSION_ACTIVITY_COOKIE,String(now),{...options,...persistence});response.cookies.set(SESSION_KEEP_COOKIE,keepSignedIn?"1":"0",{...options,...persistence});
}
export function clearSessionControlCookies(response:NextResponse){for(const name of [SESSION_START_COOKIE,SESSION_ACTIVITY_COOKIE,SESSION_KEEP_COOKIE])response.cookies.set(name,"",{...options,maxAge:0})}
export function sessionTiming(startValue?:string,activityValue?:string,now=Date.now()){const start=Number(startValue),activity=Number(activityValue);if(!startValue||!activityValue||!Number.isFinite(start)||!Number.isFinite(activity))return{expired:true};return{expired:now-start>=ABSOLUTE_TIMEOUT_MS||now-activity>=IDLE_TIMEOUT_MS}}
