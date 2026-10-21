import{redirect}from"next/navigation";
export default async function OwnersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const params=new URLSearchParams();for(const[key,value]of Object.entries(await searchParams))if(value)params.set(key,value);params.delete("accountType");params.set("hasListings","yes");redirect(`/admin/users?${params}`)}
