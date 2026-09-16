"use client";

import Script from "next/script";
import {useCallback,useEffect,useRef,useState} from "react";

type PlaceResult={formatted_address?:string;name?:string;geometry?:{location?:{lat:()=>number;lng:()=>number}}};
type AutocompleteInstance={addListener:(event:string,handler:()=>void)=>{remove:()=>void};getPlace:()=>PlaceResult};
type MapsWindow=Window&{google?:{maps?:{places?:{Autocomplete:new (input:HTMLInputElement,options:Record<string,unknown>)=>AutocompleteInstance}}}};

export function PropertyLocationPicker({latitude,longitude}:{latitude?:unknown;longitude?:unknown}){
  const apiKey=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY||"";
  const inputRef=useRef<HTMLInputElement>(null),listenerRef=useRef<{remove:()=>void}|null>(null);
  const[lat,setLat]=useState(latitude==null?"":String(latitude)),[lng,setLng]=useState(longitude==null?"":String(longitude));
  const[status,setStatus]=useState(apiKey?"Loading location search…":"Location search is unavailable until the Google Maps key is configured. Existing coordinates will be preserved.");
  const initialise=useCallback(()=>{
    const google=(window as MapsWindow).google;if(!apiKey||!inputRef.current||!google?.maps?.places?.Autocomplete)return;
    listenerRef.current?.remove();
    const autocomplete=new google.maps.places.Autocomplete(inputRef.current,{fields:["formatted_address","geometry","name"],componentRestrictions:{country:"in"}});
    listenerRef.current=autocomplete.addListener("place_changed",()=>{const place=autocomplete.getPlace(),point=place.geometry?.location;if(!point){setStatus("Choose a location from the suggestions to capture its map coordinates.");return}setLat(String(point.lat()));setLng(String(point.lng()));setStatus(`Selected: ${place.formatted_address||place.name||"property location"}`)});
    setStatus("Search and choose a suggestion to capture the property coordinates.");
  },[apiKey]);
  useEffect(()=>()=>listenerRef.current?.remove(),[]);
  return <label className="wide property-location-picker"><span>Search property location</span>
    {apiKey&&<Script src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`} strategy="afterInteractive" onLoad={initialise} onError={()=>setStatus("Google location search could not be loaded. Existing coordinates will be preserved.")}/>} 
    <input ref={inputRef} type="search" autoComplete="off" placeholder="Search an address or landmark" disabled={!apiKey}/>
    <input type="hidden" name="latitude" value={lat}/><input type="hidden" name="longitude" value={lng}/>
    <small role="status">{status}</small>
  </label>;
}
