import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/generator/**/*.test.ts"],
    testTimeout: 300_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
