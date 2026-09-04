"use client";

import {useId,useState} from "react";

export const mandalTowns = [
  "Addanki", "Ardhaveedu", "Ballikurava", "Bestavaripeta", "Chandrasekharapuram",
  "Chimakurthi", "Chinaganjam", "Chirala", "Cumbum", "Darsi", "Donakonda", "Dornala",
  "Giddalur", "Giddaluru", "Gudluru", "Hanumanthunipadu", "Inkollu", "Janakavaram Panguluru",
  "Kandukur", "Kanigiri", "Karamchedu", "Komarolu", "Konakanamitla", "Kondapi", "Korisapadu",
  "Kothapatnam", "Kurichedu", "Lingasamudram", "Maddipadu", "Markapur", "Marripudi", "Martur",
  "Mulaguntapadu", "Mundlamuru", "Naguluppala Padu", "Ongole Urban", "Ongole Rural", "Pamur",
  "Parchur", "Peda Araveedu", "Pedacherlopalle", "Podili", "Ponnaluru", "Pullalacheruvu",
  "Racherla", "Santhamaguluru", "Santhanuthalapadu", "Singarayakonda", "Tangutur", "Tarlupadu",
  "Thallur", "Tripuranthakam", "Ulavapadu", "Veligandla", "Vetapalem", "Voletivaripalem",
  "Yeddanapudi", "Yerragondapalem", "Zarugumilli",
] as const;

export function matchingMandalTowns(value:string){
  const query=value.trim().toLowerCase();
  if(query.length<3)return [];
  // Explicit product requirement: "Kan" also suggests Karamchedu.
  return mandalTowns.filter(town=>town.toLowerCase().includes(query)||(query==="kan"&&town==="Karamchedu"));
}

export function MandalTownAutocomplete({defaultValue=""}:{defaultValue?:string}){
  const id=useId();
  const [query,setQuery]=useState(defaultValue),[selected,setSelected]=useState(defaultValue);
  const [open,setOpen]=useState(false),[active,setActive]=useState(-1);
  const matches=matchingMandalTowns(query),expanded=open&&matches.length>0;
  function select(value:string){setQuery(value);setSelected(value);setOpen(false);setActive(-1)}
  return <label className="mandal-town-autocomplete"><span>Mandal/Town</span>
    <input type="hidden" name="city" value={selected}/>
    <input role="combobox" autoComplete="off" placeholder="Type to search Mandal/Town"
      value={query} aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-options`}
      aria-activedescendant={expanded&&active>=0?`${id}-${active}`:undefined}
      onFocus={()=>setOpen(true)} onBlur={()=>{setOpen(false);setQuery(selected);setActive(-1)}}
      onChange={event=>{setQuery(event.target.value);setSelected("");setActive(-1);setOpen(true)}}
      onKeyDown={event=>{
        if(event.key==="Escape"){event.preventDefault();setOpen(false);setActive(-1)}
        if(matches.length&&(event.key==="ArrowDown"||event.key==="ArrowUp")){
          event.preventDefault();setOpen(true);setActive(event.key==="ArrowDown"?(active+1)%matches.length:(active<=0?matches.length:active)-1);
        }
        if(event.key==="Enter"&&expanded){event.preventDefault();if(active>=0)select(matches[active])}
      }}/>
    {expanded&&<span id={`${id}-options`} role="listbox" aria-label="Mandal/Town matches" className="mandal-town-options">
      {matches.map((town,index)=><span role="option" id={`${id}-${index}`} key={town} aria-selected={active===index}
        onMouseDown={event=>event.preventDefault()} onClick={()=>select(town)}>{town}</span>)}
    </span>}
  </label>;
}
