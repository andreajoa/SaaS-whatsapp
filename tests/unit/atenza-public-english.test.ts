import { describe, expect, it } from "vitest";
import { mercadoInglesDoVisitante, traduzirAcessoEmIngles } from "@/lib/mercado/idioma-publico-en";
import { isPublicPath } from "@/lib/auth/public-paths";
describe("Atenza UK/US acquisition journey", () => {
  it("routes GB and US to their own English markets", () => {
    expect(mercadoInglesDoVisitante("GB", null, "pt-BR")).toBe("en-gb");
    expect(mercadoInglesDoVisitante("US", null, "pt-BR")).toBe("en-us");
  });
  it("honours explicit campaign selection regardless of detected IP", () => {
    expect(mercadoInglesDoVisitante("BR", "en-gb", "pt-BR")).toBe("en-gb");
  });
  it("uses browser English only when no country is known", () => {
    expect(mercadoInglesDoVisitante(null, null, "en-GB,en;q=.9")).toBe("en-gb");
    expect(mercadoInglesDoVisitante(null, null, "en-US,en;q=.9")).toBe("en-us");
    expect(mercadoInglesDoVisitante("BR", null, "en-US,en;q=.9")).toBeNull();
  });
  it("keeps English pricing routes public", () => {
    expect(isPublicPath("/en-gb/pricing")).toBe(true);
    expect(isPublicPath("/en-us/pricing")).toBe(true);
    expect(isPublicPath("/en-gb/admin")).toBe(false);
  });
  it("translates public authentication labels", () => {
    expect(traduzirAcessoEmIngles("Criar conta")).toBe("Create account");
    expect(traduzirAcessoEmIngles("Senha")).toBe("Password");
  });
});
