import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "src/**/*.spec.js", "tests/**/*.test.js"],
    globals: true,
    testTimeout: 10000,
  },
});
