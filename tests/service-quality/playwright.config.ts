import { defineConfig } from "@playwright/test";
import central from "../../playwright.config";
// Reusa somente o ambiente fresco canônico. Executa apenas esta jornada, um worker.
export default defineConfig({
  ...central,
  testDir: ".",
  testMatch: "service-quality.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
});
