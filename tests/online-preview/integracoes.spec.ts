import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

for (const [device, viewport] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  test(`${device}: login, API real, persistência, metas e campanhas`, async ({ page, context }, info) => {
    await page.setViewportSize(viewport);
    const origin = new URL(process.env.ATENZA_PREVIEW_URL!).origin;
    // Somente o preview recebe OIDC. Supabase, GitHub e outros domínios não.
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin === origin) {
        await route.continue({ headers: {
          ...route.request().headers(),
          'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN!,
        } });
      } else { await route.continue(); }
    });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.name));

    await page.goto('/login');
    await page.locator('#email').fill(process.env.ATENZA_TEST_EMAIL!);
    await page.locator('#password').fill(process.env.ATENZA_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(/\/app\//);
    const identity = await page.evaluate(async () => {
      const response = await fetch('/api/v1/auth/interface');
      return { status: response.status, body: await response.json() };
    });
    expect(identity.status).toBe(200);
    expect(identity.body.data.organization_id).toBe(process.env.ATENZA_TEST_ORG);

    const commerce = page.waitForResponse(r => r.url().endsWith('/api/v1/integrations/commerce') && r.request().method() === 'GET');
    await page.goto('/app/integrations');
    expect((await commerce).status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Conectar Shopify', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conectar WooCommerce', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${device}-integracoes.png`), fullPage: true });
    await page.getByRole('link', { name: 'Ações por API', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Ações de integração', exact: true })).toBeVisible();
    const name = `Consulta GitHub ${device} ${randomUUID().slice(0, 8)}`;
    await page.locator('#action-name').fill(name);
    await page.locator('#action-description').fill('Consultar informações públicas do repositório sem alterar dados.');
    await page.locator('#action-url').fill('https://api.github.com/repos/supabase/supabase');
    await page.locator('input[name=enabled]').check();
    await page.locator('#action-schema').fill('{"type":"object","properties":{},"additionalProperties":false}');
    await page.getByText('Corpo, retorno e limites', { exact: true }).click();
    await page.locator('#action-public-headers').fill('{"Accept":"application/vnd.github+json"}');
    await page.locator('#action-credentials').fill('{"User-Agent":"Atenza-Validation"}');
    await page.locator('#action-return').fill('{"repository":"full_name","url":"html_url"}');
    const saved = page.waitForResponse(r => r.url().endsWith('/api/v1/integration-actions') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Salvar ação', exact: true }).click();
    expect((await saved).status()).toBe(201);
    await expect(page.getByText('Executar e testar', { exact: true })).toBeVisible();
    await expect(page.locator('#action-credentials')).toHaveValue('');
    await page.locator('#execution-inputs').fill('{}');
    const executed = page.waitForResponse(r => /\/integration-actions\/[^/]+\/test$/.test(r.url()));
    await page.getByRole('button', { name: 'Testar chamada real', exact: true }).click();
    const response = await executed;
    expect(response.status()).toBe(200);
    const result = (await response.json()).data;
    expect(result).toMatchObject({ success: true, http_status: 200, outcome_uncertain: false,
      data: { repository: 'supabase/supabase' } });
    await expect(page.getByText('supabase/supabase', { exact: false }).first()).toBeVisible();
    await page.reload();
    await expect(page.locator('summary').filter({ hasText: name })).toContainText('Concluída');
    await page.screenshot({ path: info.outputPath(`${device}-acao-api.png`), fullPage: true });

    await page.goto('/app/ai/agents/new');
    const selectedAction = page.locator('label').filter({ hasText: name }).locator('input[type=checkbox]');
    await expect(selectedAction).toBeVisible();
    await selectedAction.check();
    await expect(selectedAction).toBeChecked();

    await page.goto('/app/ai/knowledge/sources');
    await page.getByTestId('acervo-adicionar').click();
    await page.getByTestId('material-tipo-url').click();
    const material = `Página de exemplo ${device} ${randomUUID().slice(0, 8)}`;
    await page.getByTestId('material-nome').fill(material);
    await page.getByTestId('material-url').fill('https://example.com/');
    const source = page.waitForResponse(r => r.url().endsWith('/api/v1/ai/knowledge/sources') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Adicionar ao acervo', exact: true }).click();
    const createdSource = await source;
    expect(createdSource.status()).toBe(201);
    expect((await createdSource.json()).data.indexacao_habilitada).toBe(false);
    await expect(page.getByText(material, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(material, { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${device}-conhecimento-url.png`), fullPage: true });

    await page.goto('/app/service-quality');
    await expect(page.getByRole('heading', { name: 'Qualidade do atendimento', exact: true })).toBeVisible();
    await page.getByLabel('Ativar metas', { exact: true }).check();
    const firstMinutes = device === 'desktop' ? '5' : '6';
    await page.getByLabel('Primeira resposta (minutos)', { exact: true }).fill(firstMinutes);
    await page.getByLabel('Resolução (minutos)', { exact: true }).fill('60');
    const policy = page.waitForResponse(r => r.url().endsWith('/api/v1/service-quality/policy') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Salvar metas', exact: true }).click();
    expect((await policy).status()).toBe(200);
    await expect(page.getByText('Metas salvas', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Primeira resposta (minutos)', { exact: true })).toHaveValue(firstMinutes);
    await page.screenshot({ path: info.outputPath(`${device}-qualidade.png`), fullPage: true });

    const campaigns = page.waitForResponse(r => r.url().endsWith('/api/v1/campaigns') && r.request().method() === 'GET');
    const options = page.waitForResponse(r => r.url().endsWith('/api/v1/campaigns/options'));
    await page.goto('/app/campaigns');
    expect((await campaigns).status()).toBe(200);
    expect((await options).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Campanhas de WhatsApp', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${device}-campanhas.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
