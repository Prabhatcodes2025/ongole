import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {env} from "@/src/lib/env";
import {createRazorpayOrder} from "@/src/lib/payments/razorpay";
import {requestIp} from "@/src/lib/request";
import {checkRateLimit} from "@/src/lib/security/rate-limit";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
const schema=z.object({kind:z.enum(["plan","promotion"]),planId:z.string().uuid().optional(),productId:z.string().uuid().optional(),propertyId:z.string().uuid().optional(),idempotencyKey:z.string().uuid()}).refine((value)=>value.kind==="plan"?Boolean(value.planId):Boolean(value.productId&&value.propertyId));
export async function POST(request:NextRequest){
  const rate=await checkRateLimit(`payment-order:${requestIp(request)}`,10,60*60_000);if(!rate.allowed)return NextResponse.json({error:"Too many payment attempts. Try again later."},{status:429});
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  if(!env.razorpay.keyId||!env.razorpay.keySecret)return NextResponse.json({error:"Online payments are currently disabled. Use manual payment instead.",manualUrl:"/dashboard/billing/manual"},{status:503});
  const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid payment request."},{status:400});
  const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401});
  const args=parsed.data.kind==="plan"?{target_plan:parsed.data.planId!,order_provider:"razorpay",request_key:parsed.data.idempotencyKey}:{target_product:parsed.data.productId!,target_property:parsed.data.propertyId!,order_provider:"razorpay",request_key:parsed.data.idempotencyKey};
  const rpc=parsed.data.kind==="plan"?"create_payment_order":"create_promotion_order";const{data,error}=await supabase.rpc(rpc,args);
  if(error)return NextResponse.json({error:"The payment order could not be created.",detail:error.message},{status:409});
  const order=data as {id:string;amount:number;currency:string;plan_name?:string;product_name?:string};
  try{
    const provider=await createRazorpayOrder({keyId:env.razorpay.keyId,keySecret:env.razorpay.keySecret,amount:Number(order.amount),currency:order.currency,receipt:order.id,notes:{local_order_id:order.id,user_id:auth.user.id}});
    const service=createSupabaseServiceClient();if(!service)throw new Error("Payment service is not configured.");
    const{error:updateError}=await service.from("payment_orders").update({provider_order_id:provider.id,status:"pending"}).eq("id",order.id).eq("user_id",auth.user.id);if(updateError)throw updateError;
    return NextResponse.json({orderId:order.id,providerOrderId:provider.id,amount:provider.amount,currency:provider.currency,keyId:env.razorpay.keyId,name:order.plan_name||order.product_name});
  }catch(error){
    const service=createSupabaseServiceClient();if(service)await service.from("payment_orders").update({status:"failed",metadata:{provider_error:true}}).eq("id",order.id);
    return NextResponse.json({error:error instanceof Error?error.message:"Payment provider unavailable."},{status:502});
  }
}
