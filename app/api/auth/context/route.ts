import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {reconcileAuthenticatedProfile} from "@/src/lib/auth/session";
export const dynamic="force-dynamic";
export async function GET(){const supabase=await createSupabaseServerClient();const{data:auth}=await supabase.auth.getUser();if(!auth.user)return NextResponse.json({error:"Authentication required."},{status:401,headers:{"Cache-Control":"no-store"}});const profile=await reconcileAuthenticatedProfile(supabase,auth.user);if(!profile.ok)return NextResponse.json({error:"Account profile is unavailable."},{status:403,headers:{"Cache-Control":"no-store"}});const{data,error}=await supabase.rpc("get_current_auth_context");if(error||!data)return NextResponse.json({error:"Authorization context is unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}})}
