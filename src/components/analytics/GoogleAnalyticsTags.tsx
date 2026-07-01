import Script from "next/script";

import { normalizeGoogleAnalyticsMeasurementId } from "@/lib/analytics/google-analytics";

type GoogleAnalyticsTagsProps = {
  measurementId?: string;
};

export function GoogleAnalyticsTags({
  measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
}: GoogleAnalyticsTagsProps) {
  const gaId = normalizeGoogleAnalyticsMeasurementId(measurementId);
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
