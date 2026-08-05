import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    environment: "jsdom",
    exclude: ["tests/e2e/**"],
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
