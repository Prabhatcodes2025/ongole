import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requestIp} from "@/src/lib/request";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
const schema=z.object({planId:z.string().uuid(),reference:z.string().trim().min(3).max(120),paymentDate:z.coerce.date(),paymentMode:z.enum(["cash","bank_transfer","upi","qr","cheque","other"]),amount:z.coerce.number().positive(),note:z.string().trim().max(2000).optional()});
const types=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
export async function POST(request:NextRequest){
  const rate=await checkRateLimit(`manual-payment:${requestIp(request)}`,6,60*60_000);if(!rate.allowed)return NextResponse.json({error:"Too many submissions. Try again later."},{status:429});
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const form=await request.formData();const parsed=schema.safeParse(Object.fromEntries(form.entries()));if(!parsed.success)return NextResponse.json({error:"Check the payment details.",fields:parsed.error.flatten().fieldErrors},{status:400});
  const proof=form.get("proof");let proofPath="";
  if(proof instanceof File&&proof.size){if(proof.size>10*1024*1024||!types.has(proof.type))return NextResponse.json({error:"Proof must be a JPG, PNG, WebP or PDF under 10 MB."},{status:400});const extension=proof.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"").toLowerCase()||"bin";proofPath=`${auth.user.id}/${crypto.randomUUID()}.${extension}`;const{error}=await supabase.storage.from("payment-proofs").upload(proofPath,proof,{contentType:proof.type,upsert:false});if(error)return NextResponse.json({error:"Payment proof could not be uploaded."},{status:500})}
  const value=parsed.data;const{data,error}=await supabase.rpc("submit_manual_payment",{target_plan:value.planId,payment_reference:value.reference,paid_on:value.paymentDate.toISOString().slice(0,10),payment_mode_value:value.paymentMode,submitted_amount:value.amount,proof_object:proofPath,request_note:value.note||""});
  if(error){if(proofPath)await supabase.storage.from("payment-proofs").remove([proofPath]);return NextResponse.json({error:error.message==="amount_mismatch"?"The amount must match the configured plan price.":"Manual payment could not be submitted."},{status:409})}
  return NextResponse.redirect(new URL(`/dashboard/billing?notice=manual-submitted&id=${data}`,request.url),303);
}
