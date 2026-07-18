type LogLevel="info"|"warn"|"error";
export function logEvent(level:LogLevel,event:string,context:Record<string,unknown>={}){
  const entry={timestamp:new Date().toISOString(),level,event,...context};
  const output=JSON.stringify(entry);
  if(level==="error")console.error(output);else if(level==="warn")console.warn(output);else console.info(output);
}
