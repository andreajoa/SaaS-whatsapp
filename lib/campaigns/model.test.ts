import { describe, expect, it } from "vitest";
import { actionSchema, validateTemplate, type TemplateSnapshot } from "./model";
const template: TemplateSnapshot = { id: "id", name: "hello", language: "pt_BR", status: "APPROVED", contract_hash: "hash", parameter_format: "POSITIONAL", components: [{ type: "BODY", text: "Olá {{1}}" }] };
describe("contratos da campanha", () => {
  it("preserva o corpo posicional simples", () => expect(validateTemplate(template, { "1": "Ana" }, "body-positional")).toBe("Olá Ana"));
  it("recusa NAMED no transporte que só recebe posições", () => expect(() => validateTemplate({ ...template, parameter_format: "NAMED", components: [{ type: "BODY", text: "Olá {{nome}}" }] }, { nome: "Ana" }, "body-positional")).toThrow(/posicionais/));
  it("recusa parâmetros de cabeçalho nesse transporte", () => expect(() => validateTemplate({ ...template, components: [{ type: "HEADER", format: "TEXT", text: "{{2}}" }, ...template.components!] }, { "header:2": "Título", "1": "Ana" }, "body-positional")).toThrow(/corpo/));
  it("recusa parâmetros de botão nesse transporte", () => expect(() => validateTemplate({ ...template, components: [...template.components!, { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver", url: "https://example.com/{{1}}" }] }] }, { "button0:1": "pedido", "1": "Ana" }, "body-positional")).toThrow(/corpo/));
  it("a conferência exige confirmação e nunca oferece reenvio", () => {
    const value = { action: "resolve_review", recipient_id: "11111111-1111-4111-8111-111111111111", resolution: "skip", confirm: true };
    expect(actionSchema.safeParse(value).success).toBe(true);
    expect(actionSchema.safeParse({ ...value, confirm: false }).success).toBe(false);
    expect(actionSchema.safeParse({ ...value, resolution: "retry" }).success).toBe(false);
  });
});
