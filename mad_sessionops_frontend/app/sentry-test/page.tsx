import { notFound } from "next/navigation";
import { enableDebug } from "@/config/env.config";
import { TestErrorButton } from "./TestErrorButton";

// Only reachable when NEXT_PUBLIC_ENABLE_DEBUG=true (dev/staging today, off
// in production) — mirrors the backend's DEBUG-gated /sentry-debug/ route.
export default function SentryTestPage() {
  if (!enableDebug) {
    notFound();
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Sentry Test</h1>
      <p>Click the button to throw a real render error and confirm it reaches Sentry.</p>
      <TestErrorButton />
    </div>
  );
}
