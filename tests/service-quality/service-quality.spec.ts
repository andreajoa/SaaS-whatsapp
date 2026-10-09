import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { qualityText } from "../../lib/service-quality/text";
import type { QualitySnapshot } from "../../lib/service-quality/metrics";
const text = qualityText("pt-BR");
/** Jornada real, sem interceptar APIs: política -> link explícito -> visitante
 * sem cookie -> feedback -> dashboard -> conversa no inbox. Precisa do baseline
 * integrado + .e2e-creds.json sintético do harness central e uma conversa semeada.
 */
test("SLA opt-in e CSAT chegam à mesma conversa sem envio automático", async ({
  page,
  browser,
}, testInfo) => {
  const creds = JSON.parse(readFileSync(resolve(process.cwd(), ".e2e-creds.json"), "utf8")) as {
    password: string;
    users: { manager: { email: string } };
  };
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.manager.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app(?:\/|$)/);
  const initialResponse = await page.request.get("/api/v1/service-quality");
  expect(initialResponse.ok()).toBeTruthy();
  const initial = (await initialResponse.json()).data as QualitySnapshot;
  expect(initial.rows.length, "O harness deve semear uma conversa real de teste.").toBeGreaterThan(
    0,
  );
  const conversation = initial.rows[0]!.conversation_id;
  const comment = `Synthetic quality E2E ${Date.now()}`;
  try {
    await page.goto("/app/service-quality");
    await expect(page.getByRole("heading", { name: text.title, exact: true })).toBeVisible();
    await page.getByLabel(text.enabled).check();
    await page.getByLabel(text.firstTarget).fill("5");
    await page.getByLabel(text.resolutionTarget).fill("60");
    const save = page.waitForResponse(
      (r) => r.url().endsWith("/api/v1/service-quality/policy") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: text.save, exact: true }).click();
    expect((await save).status()).toBe(200);
    await page.getByLabel(text.conversationId).fill(conversation);
    await page.getByLabel(text.expiry).fill("24");
    const create = page.waitForResponse(
      (r) => r.url().endsWith("/api/v1/service-quality/surveys") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: text.create, exact: true }).click();
    const result = await (await create).json();
    expect(result.data.sent).toBe(false);
    const feedback = page.getByLabel(text.copy, { exact: true });
    await expect(feedback).toBeVisible();
    const invitation = await feedback.inputValue();
    expect(invitation).toContain(result.data.feedback_path);
    await page.screenshot({ path: testInfo.outputPath("manager-link.png"), fullPage: true });
    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    try {
      await visitor.goto(new URL(result.data.feedback_path, page.url()).href);
      await expect(visitor.getByRole("heading", { name: text.feedbackTitle })).toBeVisible();
      await visitor.getByRole("radio", { name: "5", exact: true }).check();
      await visitor.getByLabel(text.comment).fill(comment);
      await visitor.getByRole("button", { name: text.submit, exact: true }).click();
      await expect(visitor.getByText(text.thanks, { exact: true })).toBeVisible();
      await visitor.screenshot({
        path: testInfo.outputPath("public-feedback.png"),
        fullPage: true,
      });
      await visitor.reload();
      await expect(visitor.getByText(text.unavailable, { exact: true })).toBeVisible();
    } finally {
      await visitorContext.close();
    }
    await page.getByRole("button", { name: text.reload, exact: true }).click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    await page.goto(`/app/inbox/${conversation}`);
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("conversation-csat.png"), fullPage: true });
  } finally {
    const restore = await page.request.put("/api/v1/service-quality/policy", {
      data: initial.policy,
    });
    expect(restore.ok()).toBeTruthy();
  }
});
