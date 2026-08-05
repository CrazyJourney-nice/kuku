import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  publicDir: "../rive",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
