import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Execução focalizada, sem carregar o setup global que lê .env reais.
export default defineConfig({
  envDir: resolve(__dirname, "fixtures/no-env"),
  test: {
    environment: "jsdom",
    include: ["tests/service-quality/*.test.tsx", "lib/service-quality/*.test.ts"],
    setupFiles: [resolve(__dirname, "unit.setup.ts")],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-placeholder.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-placeholder-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-placeholder-service-role-key",
    },
  },
  resolve: { alias: { "@": resolve(__dirname, "../..") } },
});
