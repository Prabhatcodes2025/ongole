"use client";

import { useState } from "react";

export function ClickToLoadMap({latitude,longitude,title}:{latitude:number;longitude:number;title:string}){const[loaded,setLoaded]=useState(false);return loaded?<div className="map-frame"><iframe title={`Map for ${title}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}/></div>:<div className="map-consent"><p>Load the interactive map only when you need it. Google may receive browser and device information after loading.</p><button className="button button-outline" type="button" onClick={()=>setLoaded(true)}>Load Google Map</button></div>}
