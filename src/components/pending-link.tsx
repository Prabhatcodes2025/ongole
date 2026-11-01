"use client";

import Link,{useLinkStatus} from "next/link";
import type {ComponentProps} from "react";

function LinkStatus(){const{pending}=useLinkStatus();return pending?<span className="link-pending-indicator" role="status" aria-label="Loading page"><i className="pending-spinner" aria-hidden="true"/></span>:null}

export function PendingLink({children,...props}:ComponentProps<typeof Link>){return <Link {...props}>{children}<LinkStatus/></Link>}
