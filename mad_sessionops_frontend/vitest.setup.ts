import "@testing-library/jest-dom";
import { vi } from "vitest";

// The real @sentry/nextjs SDK pulls in tracing/replay/OpenTelemetry and is
// expensive to import. Every test file that transitively imports errorHandler.ts
// or ErrorBoundary.tsx was paying that cost, which starved CPU across parallel
// workers and caused unrelated interaction tests to blow their 5s timeout.
vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));
