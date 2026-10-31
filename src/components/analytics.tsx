
"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { PublicPageAnalytics } from "@/src/components/public-page-analytics";

const CONSENT_KEY = "ongoleproperty.analytics-consent";

type Consent = "unknown" | "granted" | "essential";

export function Analytics({
  measurementId,
  metaPixelId,
}: {
  measurementId?: string;
  metaPixelId?: string;
}) {
  const [consent, setConsent] = useState<Consent>("unknown");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CONSENT_KEY);

      if (saved === "granted" || saved === "essential") {
        setConsent(saved);
      }
    } catch {
      // Continue without persistent storage.
    }

    setReady(true);
  }, []);

  function choose(value: "granted" | "essential") {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // Apply the preference for this page.
    }

    setConsent(value);
    setOpen(false);
    setDismissed(true);

    window.dispatchEvent(
      new CustomEvent("op:analytics-consent", {
        detail: value,
      })
    );

    // Reload if analytics was previously enabled,
    // so already loaded tracking scripts stop running.
    if (consent === "granted" && value === "essential") {
      window.location.reload();
    }
  }

  function closePreferences() {
    setOpen(false);
    setDismissed(true);
  }

  const showBanner =
    ready && (open || (consent === "unknown" && !dismissed));

  const allowed = ready && consent === "granted";

  return (
    <>
      <PublicPageAnalytics />

      <button
        type="button"
        className="privacy-preferences"
        onClick={() => {
          setOpen(true);
          setDismissed(false);
        }}
        aria-expanded={showBanner}
        aria-controls="analytics-preferences"
      >
        Privacy
      </button>

      {showBanner && (
        <aside
          id="analytics-preferences"
          className="cookie-consent"
          aria-label="Analytics preferences"
        >
          <button
            type="button"
            className="privacy-close"
            aria-label="Close analytics preferences"
            onClick={closePreferences}
          >
            ×
          </button>

          <p>
            <strong>Analytics preferences</strong>
            <span>
              Optional Google and Meta analytics run only with
              permission.{" "}
              <a href="/cookie-policy">Cookie policy</a>
            </span>
          </p>

          <div>
            <button
              type="button"
              className="button button-small"
              onClick={() => choose("granted")}
            >
              Allow analytics
            </button>

            <button
              type="button"
              className="button button-light button-small"
              onClick={() => choose("essential")}
            >
              Essential only
            </button>
          </div>
        </aside>
      )}

      {allowed && measurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
            strategy="afterInteractive"
          />

          <Script id="ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments)}
              gtag('js', new Date());
              gtag('config', '${measurementId.replace(/[^A-Z0-9-]/gi, "")}', {
                anonymize_ip: true
              });
            `}
          </Script>
        </>
      )}

      {allowed && metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){
              if(f.fbq)return;
              n=f.fbq=function(){
                n.callMethod
                  ? n.callMethod.apply(n,arguments)
                  : n.queue.push(arguments)
              };
              if(!f._fbq)f._fbq=n;
              n.push=n;
              n.loaded=!0;
              n.version='2.0';
              n.queue=[];
              t=b.createElement(e);
              t.async=!0;
              t.src=v;
              s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)
            }(
              window,
              document,
              'script',
              'https://connect.facebook.net/en_US/fbevents.js'
            );

            fbq('init','${metaPixelId.replace(/\D/g, "")}');
            window.dispatchEvent(new Event('op:meta-ready'));
          `}
        </Script>
      )}
    </>
  );
}
