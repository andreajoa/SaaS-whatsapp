import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { NavegacaoDaHome } from "./NavegacaoDaHome";

afterEach(cleanup);

it("selecionar a seção fecha a navegação para não cobrir o destino no celular", () => {
  render(
    <NavegacaoDaHome
      abrir="Abrir"
      rotulo="Navegação"
      itens={[{ href: "#planos", texto: "Planos" }]}
    />,
  );
  const details = document.querySelector("details")!;
  details.open = true;
  fireEvent.click(screen.getByText("Planos"));
  expect(details.open).toBe(false);
});

it("Escape fecha o menu e devolve o foco ao controle", () => {
  render(
    <NavegacaoDaHome
      abrir="Abrir"
      rotulo="Navegação"
      itens={[{ href: "#planos", texto: "Planos" }]}
    />,
  );
  const details = document.querySelector("details")!;
  details.open = true;
  fireEvent.keyDown(screen.getByText("Planos"), { key: "Escape" });
  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(details.querySelector("summary"));
});
