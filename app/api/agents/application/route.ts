import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {normalizeEmail} from "@/src/lib/auth/session";
import {normalizeMobile,isValidIndianMobile} from "@/src/lib/auth/mobile";

const schema=z.object({name:z.string().trim().min(2).max(100),mobile:z.string().transform(normalizeMobile).refine(isValidIndianMobile),email:z.email().transform(normalizeEmail),yearsExperience:z.union([z.coerce.number().int().min(0).max(80),z.literal("").transform(()=>undefined)]).optional(),officeAddress:z.string().trim().max(500).optional().default(""),about:z.string().trim().max(1500).optional().default(""),workingTowns:z.string().trim().max(300).optional().default(""),specializations:z.string().trim().max(500).optional().default("")});
const list=(value:string,limit:number)=>[...new Set(value.split(",").map(item=>item.trim()).filter(Boolean))].slice(0,limit);

export async function POST(request:NextRequest){
  const supabase=await createSupabaseServerClient(),{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Sign in to submit your agent application."},{status:401});
  if(!user.email_confirmed_at)return NextResponse.json({error:"Verify your email address before submitting your application."},{status:403});
  const parsed=schema.safeParse(Object.fromEntries(await request.formData()));
  if(!parsed.success)return NextResponse.json({error:"Check your contact and application details.",fields:parsed.error.flatten().fieldErrors},{status:400});
  const [{data:profile},{data:existing}]=await Promise.all([supabase.from("profiles").select("full_name,email,mobile,account_type").eq("id",user.id).maybeSingle(),supabase.from("agents").select("id,status").eq("user_id",user.id).maybeSingle()]);
  if(!profile)return NextResponse.json({error:"Your account profile could not be loaded."},{status:403});
  if(profile.account_type!=="agent")return NextResponse.json({error:"This account is not registered as a real estate agent."},{status:403});
  if(normalizeEmail(profile.email||"")!==parsed.data.email||normalizeMobile(profile.mobile||"")!==parsed.data.mobile||profile.full_name?.trim().toLowerCase()!==parsed.data.name.toLowerCase())return NextResponse.json({error:"The application name, mobile and email must match your authenticated account profile."},{status:400});
  if(existing?.status&&existing.status!=="pending")return NextResponse.json({error:"This agent application has already been reviewed."},{status:409});
  if(!existing)return NextResponse.json({error:"Your private agent application could not be initialized. Please contact support."},{status:409});
  const {data:saved,error}=await supabase.from("agents").update({years_experience:parsed.data.yearsExperience??null,office_address:parsed.data.officeAddress||null,about:parsed.data.about||null,working_towns:list(parsed.data.workingTowns,5),specializations:list(parsed.data.specializations,20)}).eq("user_id",user.id).eq("status","pending").select("id").maybeSingle();
  if(error)return NextResponse.json({error:"The agent application could not be saved."},{status:500});
  if(!saved)return NextResponse.json({error:"This agent application has already been reviewed."},{status:409});
  return NextResponse.json({ok:true});
}
