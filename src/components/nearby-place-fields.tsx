type Values=Record<string,unknown>;
const value=(defaults:Values,key:string)=>defaults[key]===undefined||defaults[key]===null?"":String(defaults[key]);
const places=[["nearbyRailwayStation","Railway Station"],["nearbyBank","Bank"],["nearbyAtm","ATM"],["nearbyCollege","College"],["nearbyHospital","Hospital"],["nearbyBusDepot","RTC Depot"]] as const;

export function NearbyPlaceFields({defaults={},required=false}:{defaults?:Values;required?:boolean}){
  return <fieldset className="wide nearby-places-fields"><legend>Nearby Places / Landmarks</legend>
    <p className="form-note wide">Enter accurate distances using the same nearby-place format used by Sale and Rent listings.</p>
    {places.map(([name,label])=><fieldset className="nearby-distance" key={name}><legend>{label}</legend><input required={required} aria-label={`${label} distance`} name={name} type="number" min="0" step="0.01" defaultValue={value(defaults,name)}/><select aria-label={`${label} distance unit`} name={`${name}Unit`} defaultValue={value(defaults,`${name}Unit`)||"meter"}><option value="meter">Meter</option><option value="km">Km</option></select></fieldset>)}
    {["", "2", "3"].map((suffix,index)=><div className="nearby-custom" key={suffix||"other"}><label>{index===0?"Other nearby place":`Custom place ${index+1}`}<input name={`nearbyOtherName${suffix}`} maxLength={120} defaultValue={value(defaults,`nearbyOtherName${suffix}`)}/></label><fieldset className="nearby-distance"><legend>Distance</legend><input aria-label={`Custom nearby place ${index+1} distance`} name={`nearbyOtherDistance${suffix}`} type="number" min="0" step="0.01" defaultValue={value(defaults,`nearbyOtherDistance${suffix}`)}/><select aria-label={`Custom nearby place ${index+1} distance unit`} name={`nearbyOtherDistanceUnit${suffix}`} defaultValue={value(defaults,`nearbyOtherDistanceUnit${suffix}`)||"meter"}><option value="meter">Meter</option><option value="km">Km</option></select></fieldset></div>)}
  </fieldset>;
}
