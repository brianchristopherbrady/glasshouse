import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/core/tests/**/*.test.ts", "packages/cli/tests/**/*.test.ts", "packages/ui/src/**/*.test.ts"],
  },
});
