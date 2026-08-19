"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            textAlign: "center",
            gap: "1.5rem",
            fontFamily: "sans-serif",
          }}
        >
          <h1>Something went wrong</h1>
          <p>We&apos;re sorry for the inconvenience. Please refresh the page.</p>
        </div>
      </body>
    </html>
  );
}
