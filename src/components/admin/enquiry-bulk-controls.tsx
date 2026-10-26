"use client";

import {useState} from "react";

export function EnquiryBulkControls(){
  const[action,setAction]=useState<"archive"|"restore">("archive");
  return <div className="crm-bulk-controls">
    <select name="action" value={action} onChange={event=>setAction(event.target.value as "archive"|"restore")}><option value="archive">Archive selected</option><option value="restore">Restore selected</option></select>
    <label><input required name="confirmation" value={action.toUpperCase()} type="checkbox"/> Confirm {action}</label>
    <button className="button button-small">Apply to selected</button>
  </div>;
}
