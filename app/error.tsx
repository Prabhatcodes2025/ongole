"use client";
import {useEffect} from "react";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error("Application error",{digest:error.digest,message:error.message})},[error]);return <main id="main" className="section shell"><div className="error-state" role="alert"><h1>Something went wrong</h1><p>The issue has been recorded. Please try again.</p><button className="button" onClick={reset}>Try again</button></div></main>}
