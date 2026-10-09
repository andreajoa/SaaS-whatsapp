import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  envDir: resolve(__dirname, "fixtures/no-env"),
  test: {
    environment: "node",
    include: ["tests/service-quality/*.db.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: { alias: { "@": resolve(__dirname, "../..") } },
});
