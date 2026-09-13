import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
export const metadata:Metadata={title:"Choose a new password",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function UpdatePasswordPage(){const supabase=await createSupabaseServerClient();const{data}=await supabase.auth.getUser();if(!data.user)redirect("/login?error=recovery_session_missing");redirect("/reset-password")}
