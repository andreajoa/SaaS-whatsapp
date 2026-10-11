import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { montarMenu } from "@/lib/marketing/menu";
import { MegaMenu } from "./MegaMenu";

afterEach(cleanup);
const menu = montarMenu((t) => t, true);

it("clicar no grupo abre o painel com os links, e clicar num link fecha", () => {
  render(<MegaMenu menu={menu} />);
  const botao = screen.getByRole("button", { name: "Funcionalidades" });
  fireEvent.click(botao);
  expect(botao.getAttribute("aria-expanded")).toBe("true");
  const link = screen.getAllByRole("link", { name: /Campanhas/ })[0]!;
  expect(link.getAttribute("href")).toBe("/recursos/campanhas-whatsapp");
  fireEvent.click(link);
  expect(botao.getAttribute("aria-expanded")).toBe("false");
});

it("Escape fecha o painel e devolve o foco ao botão do grupo", () => {
  render(<MegaMenu menu={menu} />);
  const botao = screen.getByRole("button", { name: "Segmentos" });
  fireEvent.click(botao);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(botao.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(botao);
});

it("no celular, escolher um destino fecha a gaveta para não cobrir a página", () => {
  render(<MegaMenu menu={menu} />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir navegação" }));
  const gaveta = screen.getByRole("dialog");
  fireEvent.click(gaveta.querySelector('a[href="/segmentos/clinicas"]')!);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("todo destino do menu é uma página que existe", async () => {
  const { PAGES_SEO } = await import("@/lib/marketing/conteudo-seo");
  const paginas = new Set(PAGES_SEO.map((p) => `/${p.slug}`));
  const fixas = new Set(["/demonstracao", "/signup", "/contato", "/#perguntas", "/#planos"]);
  const destinos = menu.grupos.flatMap((g) => [...g.itens.map((i) => i.href), g.destaque.href]);
  const quebrados = destinos.filter((h) => !paginas.has(h) && !fixas.has(h));
  expect(quebrados).toEqual([]);
});
