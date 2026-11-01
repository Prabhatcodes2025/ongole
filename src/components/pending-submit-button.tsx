"use client";

import type {ButtonHTMLAttributes,ReactNode} from "react";
import {useFormStatus} from "react-dom";

export function PendingSubmitButton({children,pendingText="Working…",className="button",disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{children:ReactNode;pendingText?:string}){const{pending}=useFormStatus();return <button {...props} className={className} type="submit" disabled={disabled||pending} aria-busy={pending}>{pending&&<i className="pending-spinner" aria-hidden="true"/>}{pending?pendingText:children}</button>}

export function FormPendingStatus({message="Updating…"}:{message?:string}){const{pending}=useFormStatus();return pending?<span className="form-pending-status" role="status" aria-live="polite"><i className="pending-spinner" aria-hidden="true"/>{message}</span>:null}
