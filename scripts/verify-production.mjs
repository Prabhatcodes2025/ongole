import {access,readFile} from "node:fs/promises";
import process from "node:process";

try{process.loadEnvFile(".env.local")}catch{/* CI and Vercel provide variables directly. */}

const failures=[];
const checks=[];
const read=async(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const requiredFile=async(path)=>{
  try{await access(new URL(`../${path}`,import.meta.url));checks.push(`file:${path}`)}
  catch{failures.push(`missing required file: ${path}`)}
};

const packageJson=JSON.parse(await read("package.json"));
for(const [name,expected] of Object.entries({build:"next build",start:"next start",lint:"eslint . --ignore-pattern .next",typecheck:"tsc --noEmit"})){
  if(packageJson.scripts?.[name]!==expected)failures.push(`package script ${name} must be: ${expected}`);
  else checks.push(`script:${name}`);
}

const dependencies={...packageJson.dependencies,...packageJson.devDependencies};
for(const name of ["vinext","wrangler","rolldown","@cloudflare/next-on-pages","@opennextjs/cloudflare"]){
  if(name in dependencies)failures.push(`incompatible deployment dependency present: ${name}`);
}
checks.push("deployment:standard-next");

for(const path of [
  "vercel.json",
  "app/api/cron/maintenance/route.ts",
  "supabase/migrations/202607300001_sprint6_launch_security.sql",
  "supabase/migrations/202607300002_sprint6_notification_scheduler.sql",
]){
  await requiredFile(path);
}

const vercel=JSON.parse(await read("vercel.json"));
if(vercel.crons?.length!==1||vercel.crons[0]?.path!=="/api/cron/maintenance"){
  failures.push("Vercel maintenance cron is missing or points to the wrong route");
}else checks.push("cron:configured");

if(process.argv.includes("--environment")){
  for(const name of [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
  ]){
    if(!process.env[name])failures.push(`missing production environment variable: ${name}`);
    else checks.push(`environment:${name}`);
  }
}

if(failures.length){
  console.error(JSON.stringify({status:"failed",failures},null,2));
  process.exit(1);
}
console.info(JSON.stringify({status:"passed",checks},null,2));
