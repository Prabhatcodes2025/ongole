import type { Metadata } from "next";
import Link from "next/link";
import {CaptchaWidget} from "@/src/components/captcha-widget";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default function LoginPage() { return <main id="main" className="auth-page"><section className="auth-card"><p className="eyebrow">Welcome back</p><h1>Sign in to your account</h1><p>Manage draft property submissions, enquiries and your profile securely.</p><form action="/api/auth/login" method="post"><label>Email<input required type="email" name="email" autoComplete="email" /></label><label>Password<input required type="password" name="password" autoComplete="current-password" minLength={8} /></label><CaptchaWidget/><button className="button" type="submit">Sign in</button></form><p><Link href="/forgot-password">Forgot your password?</Link></p><p>New to OngoleProperty.com? <Link href="/register">Create a free account</Link></p></section></main>; }
