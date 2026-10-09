import { defineConfig } from '@playwright/test';

const baseURL = process.env.ATENZA_PREVIEW_URL;
if (!baseURL || !/^https:\/\/saa-s-whatsapp-[a-z0-9-]+-andres-projects-bbfd1881\.vercel\.app$/.test(baseURL)) {
  throw new Error('Informe um preview Atenza; domínio de produção não é permitido.');
}
if (process.env.ATENZA_TEST_SUPABASE_URL !== 'https://zaagoawswxlwzwhmtzyi.supabase.co') {
  throw new Error('Estas jornadas exigem o projeto Free dedicado à validação.');
}
for (const key of ['ATENZA_TEST_EMAIL', 'ATENZA_TEST_PASSWORD', 'ATENZA_TEST_ORG', 'VERCEL_OIDC_TOKEN']) {
  if (!process.env[key]) throw new Error(`Falta a configuração privada ${key}.`);
}

export default defineConfig({
  testDir: '.',
  testMatch: 'integracoes.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  outputDir: '../../.superpowers/evidence/atenza-online-preview',
  use: {
    baseURL,
    locale: 'pt-BR',
    launchOptions: { executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH },
    // OIDC é uma credencial: traces/estado de autenticação não viram artefatos.
    trace: 'off',
    screenshot: 'off',
  },
});
