const GOOGLE_MAPS_HOSTS=new Set(["maps.google.com","maps.app.goo.gl"]);

export function safeGoogleMapsUrl(value:unknown){
  if(typeof value!=="string"||value.length>1000)return null;
  try{
    const url=new URL(value.trim());
    if(url.protocol!=="https:")return null;
    const host=url.hostname.toLowerCase().replace(/^www\./,"");
    if(GOOGLE_MAPS_HOSTS.has(host))return url.toString();
    if((host==="google.com"||host.endsWith(".google.com"))&&url.pathname.toLowerCase().startsWith("/maps"))return url.toString();
    return null;
  }catch{return null}
}
