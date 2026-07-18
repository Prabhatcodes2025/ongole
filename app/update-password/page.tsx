import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {CaptchaWidget} from "@/src/components/captcha-widget";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
export const metadata:Metadata={title:"Choose a new password",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function UpdatePasswordPage({searchParams}:{searchParams:Promise<{error?:string}>}){const supabase=await createSupabaseServerClient();const{data}=await supabase.auth.getUser();if(!data.user)redirect("/login?error=recovery_session_missing");const query=await searchParams;return <main id="main" className="auth-page"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Choose a new password</h1>{query.error&&<p className="form-message error" role="alert">The password could not be updated. Enter at least eight characters and try again.</p>}<form action="/api/auth/update-password" method="post"><label>New password<input required type="password" name="password" autoComplete="new-password" minLength={8}/></label><CaptchaWidget/><button className="button">Update password</button></form></section></main>}
