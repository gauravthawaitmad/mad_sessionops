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
