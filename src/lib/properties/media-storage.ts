export function propertyMediaStoragePaths(
  storagePath:string,
  variants:unknown,
):string[]{
  const paths=new Set<string>();
  if(storagePath)paths.add(storagePath);

  function visit(value:unknown,key?:string){
    if(key==="path"&&typeof value==="string"&&value)paths.add(value);
    else if(Array.isArray(value))value.forEach(item=>visit(item));
    else if(value&&typeof value==="object"){
      for(const [childKey,child] of Object.entries(value))visit(child,childKey);
    }
  }

  visit(variants);
  return [...paths];
}
