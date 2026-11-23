import {NextRequest,NextResponse} from "next/server";
import {logEvent} from "@/src/lib/observability/logger";
import {canManagePropertyMedia} from "@/src/lib/properties/media-authorization";
import {propertyMediaStoragePaths} from "@/src/lib/properties/media-storage";
import {requestData} from "@/src/lib/request";
import {createSupabaseServerClient} from "@/src/lib/supabase/server";
import {createSupabaseServiceClient} from "@/src/lib/supabase/service";

type RouteContext={params:Promise<{id:string;mediaId:string}>};
type MediaAction="up"|"down"|"cover"|"remove";

function destination(request:NextRequest,propertyId:string,result:string){
  const pgId=request.nextUrl.searchParams.get("context")==="pg"?request.nextUrl.searchParams.get("pgId"):null;
  if(request.nextUrl.searchParams.get("returnTo")==="admin")return `/admin/properties/${propertyId}/edit?media=${result}`;
  if(pgId&&/^[0-9a-f-]{36}$/i.test(pgId))return `/dashboard/pg/${pgId}?media=${result}`;
  return `/dashboard/properties/${propertyId}?media=${result}`;
}

function response(request:NextRequest,propertyId:string,result:string,status:number,payload:Record<string,unknown>={}){
  const redirectTo=destination(request,propertyId,result);
  if(request.headers.get("accept")?.includes("application/json"))return NextResponse.json({...payload,result,redirectTo},{status});
  return NextResponse.redirect(new URL(redirectTo,request.url),303);
}

async function handle(request:NextRequest,context:RouteContext,methodAction?:MediaAction){
  const{id,mediaId}=await context.params;
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return response(request,id,"failed",403,{error:"Invalid request origin."});

  const supabase=await createSupabaseServerClient();
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)return response(request,id,"failed",401,{error:"Authentication required."});

  const isPg=request.nextUrl.searchParams.get("context")==="pg";
  const[{data:property},{data:propertiesManage},{data:pgManage},{data:pgListing}]=await Promise.all([
    supabase.from("properties").select("id,reference_no,status,owner_id").eq("id",id).maybeSingle(),
    supabase.rpc("has_permission",{required_permission:"properties.manage"}),
    supabase.rpc("has_permission",{required_permission:"pg.manage"}),
    supabase.from("pg_listings").select("id").eq("property_id",id).maybeSingle(),
  ]);
  const isOwner=property?.owner_id===auth.user.id;
  const canManage=canManagePropertyMedia({
    isOwner,
    ownerEditable:Boolean(isOwner&&["draft","changes_requested"].includes(property?.status||"")),
    hasPropertiesManage:propertiesManage===true,
    hasPgManage:pgManage===true,
    isPgListing:Boolean(pgListing),
    requestedPgContext:isPg,
  });
  if((!property&&!pgListing)||!canManage)return response(request,id,"locked",403,{error:"Media is locked."});

  const{data:media,error:mediaError}=await supabase.from("property_media").select("id,storage_path,is_cover,sort_order,variants").eq("id",mediaId).eq("property_id",id).eq("media_type","image").maybeSingle();
  if(mediaError){
    logEvent("error","property.media_read_failed",{propertyId:id,mediaId,code:mediaError.code});
    return response(request,id,"failed",500,{error:"The image could not be loaded."});
  }
  if(!media)return response(request,id,"failed",404,{error:"Image not found."});

  const payload=methodAction?{}:await requestData(request);
  const action=methodAction||(typeof payload.action==="string"?payload.action:"");
  if(!["up","down","cover","remove"].includes(action))return response(request,id,"failed",400,{error:"Invalid media action."});
  const mediaAction=action as MediaAction;

  const{data:result,error:actionError}=await supabase.rpc("manage_property_media",{target_property:id,target_media:mediaId,media_action:mediaAction});
  if(actionError){
    logEvent("error","property.media_action_failed",{propertyId:id,mediaId,action:mediaAction,code:actionError.code});
    return response(request,id,"failed",actionError.message.includes("not_authorized")?403:500,{error:"The image could not be updated. Please retry."});
  }

  const reference=property?.reference_no||id;
  const{error:auditError}=await supabase.rpc("record_audit_event",{event_action:`media.${mediaAction}`,event_type:"property_media",event_reference:reference,event_new:{media_id:mediaId}});
  if(auditError)logEvent("warn","property.media_audit_failed",{propertyId:id,mediaId,action:mediaAction,code:auditError.code});

  let cleanupPending=false;
  if(mediaAction==="remove"){
    const paths=propertyMediaStoragePaths(media.storage_path,media.variants);
    if(paths.length){
      const storageClient=createSupabaseServiceClient()||supabase;
      const{error:storageError}=await storageClient.storage.from("property-media").remove(paths);
      if(storageError){
        cleanupPending=true;
        logEvent("error","property.media_storage_delete_failed",{propertyId:id,mediaId,pathCount:paths.length,code:storageError.name});
      }
    }
  }
  return response(request,id,mediaAction,cleanupPending?202:200,{success:true,media:result,cleanupPending});
}

export async function PATCH(request:NextRequest,context:RouteContext){
  const payload=await requestData(request);
  const action=typeof payload.action==="string"?payload.action:"";
  if(action!=="up"&&action!=="down"&&action!=="cover"){
    const{id}=await context.params;
    return response(request,id,"failed",400,{error:"Invalid media action."});
  }
  return handle(request,context,action);
}

export async function DELETE(request:NextRequest,context:RouteContext){return handle(request,context,"remove")}

// Backward compatibility for non-JavaScript clients; current controls use PATCH/DELETE.
export async function POST(request:NextRequest,context:RouteContext){return handle(request,context)}
