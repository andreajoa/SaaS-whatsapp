import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { LogotipoDoProduto } from "./MarcaDoProduto";
import { DEFAULT_APP_NAME } from "@/lib/branding";

afterEach(cleanup);

it("Atenza usa o arquivo original com símbolo e nome, inclusive nas páginas em inglês", () => {
  render(<LogotipoDoProduto nome="Atenza" />);
  const logo = screen.getByRole("img", { name: "Atenza" });
  expect(logo.querySelector("image")?.getAttribute("href")).toBe("/media/atenza/atenza-logo.png");
  expect(logo.querySelectorAll("path")).toHaveLength(0);
  expect(existsSync(resolve("public/media/atenza/atenza-logo.png"))).toBe(true);
});

it("preserva o desenho padrão para instalações que ainda usam a marca padrão", () => {
  render(<LogotipoDoProduto nome={DEFAULT_APP_NAME} />);
  const logo = screen.getByRole("img", { name: DEFAULT_APP_NAME });
  expect(logo.querySelector("image")).toBeNull();
  expect(logo.querySelectorAll("path").length).toBeGreaterThan(0);
});
