const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supabaseUrl: publicUrl,
  supabaseAnonKey: publicAnonKey,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  captchaSecret: process.env.CAPTCHA_SECRET_KEY,
  captchaSiteKey: process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY,
  redisUrl: process.env.REDIS_URL,
  redisToken: process.env.REDIS_TOKEN,
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY,
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  sentryDsn: process.env.SENTRY_DSN,
  razorpay:{keyId:process.env.RAZORPAY_KEY_ID,keySecret:process.env.RAZORPAY_KEY_SECRET,webhookSecret:process.env.RAZORPAY_WEBHOOK_SECRET},
  smtp: { host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),user:process.env.SMTP_USER,password:process.env.SMTP_PASSWORD,from:process.env.SMTP_FROM_EMAIL,admin:process.env.ADMIN_NOTIFICATION_EMAIL },
  isSupabaseConfigured: Boolean(publicUrl && publicAnonKey),
  isProduction: process.env.NODE_ENV === "production",
} as const;

export function requireSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return { url: env.supabaseUrl, anonKey: env.supabaseAnonKey };
}
