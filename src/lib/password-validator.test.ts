import { describe, it, expect } from "vitest";
import { validatePassword } from "./password-validator";

describe("validatePassword — regras de mínimo", () => {
  it("rejeita senha com menos de 10 caracteres", () => {
    const result = validatePassword("Abc123");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("10 caracteres");
    expect(result.strength).toBe("fraca");
  });

  it("rejeita senha vazia", () => {
    expect(validatePassword("").ok).toBe(false);
  });

  it("rejeita senha só com números", () => {
    const result = validatePassword("1234567890");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("letra");
  });

  it("rejeita senha só com letras", () => {
    const result = validatePassword("abcdefghij");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("número");
  });

  it("aceita senha com letra + número + 10 caracteres", () => {
    expect(validatePassword("senha12345Q").ok).toBe(true);
  });
});

describe("validatePassword — bloqueio de senhas comuns", () => {
  it("rejeita 12345678910 (numérica longa)", () => {
    const result = validatePassword("12345678910");
    // falha por não ter letra OU por estar em comum — qualquer um serve
    expect(result.ok).toBe(false);
  });

  it("rejeita 'password123' (top comum)", () => {
    const result = validatePassword("password123");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("comum");
  });

  it("rejeita 'senha123' (pt-BR comum)", () => {
    expect(validatePassword("senha123").ok).toBe(false);
  });

  it("rejeita 'trevo12345' (específico da empresa)", () => {
    expect(validatePassword("trevo12345").ok).toBe(false);
  });

  it("comparação é case-insensitive — 'PASSWORD123' também rejeitado", () => {
    expect(validatePassword("PASSWORD123").ok).toBe(false);
  });
});

describe("validatePassword — graduação de força", () => {
  it("'forte' precisa pelo menos 14 chars OU 12 chars + símbolo", () => {
    expect(validatePassword("Senha12345Forte!").strength).toBe("forte");
    expect(validatePassword("Sn4!aB#cD2eF").strength).toBe("forte");
  });

  it("'media' tem letra+número mas é curta ou sem variedade extra", () => {
    expect(validatePassword("senha12345Q").strength).toBe("media");
  });

  it("nunca retorna 'forte' pra senha inválida", () => {
    expect(validatePassword("12345").strength).toBe("fraca");
  });
});
