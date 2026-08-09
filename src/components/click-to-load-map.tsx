"use client";

import { useState } from "react";

export function ClickToLoadMap({latitude,longitude,title,apiKey}:{latitude:number;longitude:number;title:string;apiKey?:string}){const[loaded,setLoaded]=useState(false);const src=apiKey?`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${latitude},${longitude}`:`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;return loaded?<div className="map-frame"><iframe title={`Map for ${title}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={src}/></div>:<div className="map-consent"><p>Load the interactive map only when you need it. Google may receive browser and device information after loading.</p><button className="button button-outline" type="button" onClick={()=>setLoaded(true)}>Load Google Map</button></div>}
