import {cache} from "react";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";

// Shares one validated auth request within a server render; never across users.
export const getDashboardAuth=cache(async()=>{
  const supabase=await createSupabaseServerClient();
  const{data}=await supabase.auth.getUser();
  return{supabase,user:data.user};
});
