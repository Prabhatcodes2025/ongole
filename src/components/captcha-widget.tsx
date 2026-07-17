import Script from "next/script";import {env} from "@/src/lib/env";
export function CaptchaWidget(){if(!env.captchaSiteKey)return null;return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer/><div className="cf-turnstile" data-sitekey={env.captchaSiteKey}/></>}
