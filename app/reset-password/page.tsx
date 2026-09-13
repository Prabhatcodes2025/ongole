import type {Metadata} from "next";
import Link from "next/link";
import {ResetPasswordForm} from "@/src/components/reset-password-form";

export const metadata:Metadata={title:"Choose a new password",robots:{index:false,follow:false}};
export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<{error?:string;notice?:string}>}){const query=await searchParams;return <main id="main" className="auth-page"><section className="auth-card"><p className="eyebrow">Account recovery</p><h1>Choose a new password</h1><ResetPasswordForm error={query.error} notice={query.notice}/><p><Link href="/login">Return to sign in</Link></p></section></main>}
