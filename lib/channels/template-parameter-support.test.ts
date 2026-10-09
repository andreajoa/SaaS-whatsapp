import { describe, expect, it } from "vitest";
import { templateParameterSupportOf } from "./template-parameter-support";

describe("contrato de parâmetros do transporte", () => {
  it("oferece somente os contratos implementados", () => {
    expect(templateParameterSupportOf("meta_cloud")).toBe("components");
    expect(templateParameterSupportOf("zernio")).toBe("body-positional");
    expect(templateParameterSupportOf("waha")).toBeNull();
    expect(templateParameterSupportOf("wacalls")).toBeNull();
  });
});
