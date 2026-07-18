"use client";
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <html lang="en-IN"><body><main style={{maxWidth:720,margin:"12vh auto",padding:24,fontFamily:"sans-serif"}}><h1>OngoleProperty is temporarily unavailable</h1><p>Please retry. If the problem continues, contact our team.</p><button onClick={reset}>Try again</button></main></body></html>}
