import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  envDir: resolve(__dirname, "tests/setup/no-env"),
  test: {
    environment: "node",
    include: [
      "tests/invariants/commerce-integrations.test.ts",
      "tests/invariants/integration-actions.test.ts",
      "tests/invariants/customer-campaigns.test.ts",
      "tests/service-quality/service-quality.db.ts",
    ],
    setupFiles: [resolve(__dirname, "tests/db/online-guard.ts")],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
