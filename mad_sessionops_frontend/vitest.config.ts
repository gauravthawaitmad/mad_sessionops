import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Default 5000ms was too tight for MUI-heavy interaction tests once the full
    // 24-file suite runs in parallel — CPU contention across workers slows down
    // async renders/waitFor enough to blow the default, even though each test
    // passes in ~1s when run in isolation. This is a ceiling, not added latency,
    // so it doesn't slow down already-passing tests.
    testTimeout: 15000,
    // Cap concurrent worker processes instead of letting Vitest default to
    // ~cpu-count forks. Each fork boots its own jsdom + MUI render tree, and
    // running that many at once on this machine starved CPU across all of
    // them, causing spurious timeouts/unresolved async renders (not real
    // bugs — confirmed by re-running failing tests in isolation, where they
    // pass every time). `pool`/`maxWorkers` are top-level options as of
    // Vitest 4 — the old nested `poolOptions.forks.*` shape was removed.
    pool: "forks",
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: ["node_modules/**", ".next/**", "**/*.config.*", "__tests__/**"],
      // Vitest's default is false — it silently discards the coverage report on any
      // test failure. Codecov's patch-coverage gate needs a report regardless, since
      // most PRs won't have every test passing on the first push.
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
