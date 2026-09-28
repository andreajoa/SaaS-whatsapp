import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({ usePathname: () => "/onboarding/setup-ai" }));
vi.mock("@/app/actions/onboarding/acceptWelcome", () => ({ acceptWelcome: vi.fn() }));
import { Stepper } from "@/app/onboarding/_components/Stepper";
import { WelcomeForm } from "@/app/onboarding/welcome/_form";
afterEach(cleanup);
it("os números levam à revisão de cada etapa, inclusive anteriores", () => {
  render(<Stepper passos={[
    { segmento: "welcome", rotulo: "Seu negócio", cumprido: true },
    { segmento: "connect-whatsapp", rotulo: "O telefone dele", cumprido: true },
    { segmento: "setup-ai", rotulo: "Treinar", cumprido: false },
  ]} />);
  expect(screen.getByRole("link", { name: "2. O telefone dele" }).getAttribute("href")).toBe("/onboarding/connect-whatsapp?revisar=1");
  expect(screen.getByRole("link", { name: "3. Treinar" }).getAttribute("aria-current")).toBe("step");
});
it("voltar ao negócio preserva ramo e fuso salvos", () => {
  render(<WelcomeForm defaultOrgName="Clínica" initialWelcome={{ o_que_faz: "Fisioterapia", timezone: "America/Manaus", accepted_at: "2026-09-28" }} />);
  expect(screen.getByDisplayValue("Fisioterapia")).toBeTruthy();
  expect(screen.getByDisplayValue("Clínica")).toBeTruthy();
  expect((document.querySelector('[name="timezone"]') as HTMLSelectElement).value).toBe("America/Manaus");
});
