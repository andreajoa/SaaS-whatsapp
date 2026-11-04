import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/branding/saida", () => ({
  marcaDaSaida: vi.fn(async () => ({
    nome: "Acme",
    logoUrl: "",
    accent: "#123456",
    accentFg: "#ffffff",
  })),
  NEUTROS_DE_SAIDA: { fundo: "#ffffff" },
}));
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(
      public element: { props: { marca: { nome: string }; lado: number } },
      public options: { width: number; height: number; headers: Record<string, string> },
    ) {}
  },
}));

import { GET, dynamic } from "@/app/logo-512.png/route";
import { marcaDaSaida } from "@/lib/branding/saida";

describe("logo público de e-mail", () => {
  it("gera 512 px com a marca atual da instalação e cache curto", async () => {
    const response = (await GET()) as unknown as {
      element: { props: { marca: { nome: string }; lado: number } };
      options: { width: number; height: number; headers: Record<string, string> };
    };
    expect(dynamic).toBe("force-dynamic");
    expect(marcaDaSaida).toHaveBeenCalledWith(null);
    expect(response.element.props.marca.nome).toBe("Acme");
    expect(response.element.props.lado).toBe(512);
    expect(response.options.width).toBe(512);
    expect(response.options.height).toBe(512);
    expect(response.options.headers["cache-control"]).toBe(
      "public, max-age=60, stale-while-revalidate=600",
    );
  });
});
