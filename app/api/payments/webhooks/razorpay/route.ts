import {NextRequest,NextResponse} from "next/server";
import {env} from "@/src/lib/env";
import {paymentPayloadHash,signatureHash,verifyRazorpayWebhookSignature} from "@/src/lib/payments/razorpay";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";
export async function POST(request:NextRequest){
  if(!env.razorpay.webhookSecret)return NextResponse.json({error:"Webhook is not configured."},{status:503});
  const raw=await request.text();const signature=request.headers.get("x-razorpay-signature")||"";
  if(!verifyRazorpayWebhookSignature(raw,signature,env.razorpay.webhookSecret))return NextResponse.json({error:"Invalid signature."},{status:401});
  const payload=JSON.parse(raw) as {event?:string;payload?:{payment?:{entity?:Record<string,unknown>}}};const payment=payload.payload?.payment?.entity||{};
  const providerEvent=request.headers.get("x-razorpay-event-id")||paymentPayloadHash(raw);const orderId=String(payment.order_id||""),paymentId=String(payment.id||"");
  if(!payload.event||!orderId||!paymentId)return NextResponse.json({received:true,ignored:true});
  const state=payload.event==="payment.captured"?"captured":payload.event==="payment.failed"?"failed":"ignored";
  if(state==="ignored")return NextResponse.json({received:true,ignored:true});
  const service=createSupabaseServiceClient();if(!service)return NextResponse.json({error:"Payment service unavailable."},{status:503});
  const{data,error}=await service.rpc("process_payment_webhook",{webhook_provider:"razorpay",provider_event:providerEvent,webhook_event_type:payload.event,signature_digest:signatureHash(signature),payload_digest:paymentPayloadHash(raw),provider_order:orderId,provider_payment:paymentId,paid_amount:Number(payment.amount||0)/100,paid_currency:String(payment.currency||"INR"),payment_state:state,failure_message:typeof payment.error_description==="string"?payment.error_description:null});
  if(error)return NextResponse.json({error:"Webhook processing failed."},{status:500});
  return NextResponse.json({received:true,result:data});
}
