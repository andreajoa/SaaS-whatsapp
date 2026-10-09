import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import base from "./vitest.config";

/** Mesma suíte e exclusões; credenciais reais nunca entram neste runner. */
export default defineConfig({
  ...base,
  envDir: resolve(__dirname, "tests/setup/no-env"),
  test: {
    ...base.test,
    setupFiles: [resolve(__dirname, "tests/setup/offline.ts")],
    maxWorkers: 2,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test-placeholder.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-placeholder-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-placeholder-service-role-key",
    },
  },
});
