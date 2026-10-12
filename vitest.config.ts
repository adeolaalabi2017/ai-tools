import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.ts"],
    /* route handlers + rate limiter keep module-level state; isolate each file */
    isolate: true,
  },
});
