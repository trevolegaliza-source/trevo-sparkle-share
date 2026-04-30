import { describe, it, expect } from "vitest";
import { isValidCNPJ, hasCNPJLength, formatCNPJ, maskCNPJ } from "./cnpj";

describe("isValidCNPJ", () => {
  it("aceita CNPJ válido (com e sem máscara)", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11222333000181")).toBe(true);
  });

  it("rejeita comprimento errado", () => {
    expect(isValidCNPJ("")).toBe(false);
    expect(isValidCNPJ(null)).toBe(false);
    expect(isValidCNPJ(undefined)).toBe(false);
    expect(isValidCNPJ("123")).toBe(false);
    expect(isValidCNPJ("11222333000")).toBe(false);
  });

  it("rejeita dígitos verificadores errados", () => {
    expect(isValidCNPJ("11.222.333/0001-82")).toBe(false);
    expect(isValidCNPJ("00.000.000/0000-01")).toBe(false);
  });

  it("rejeita sequências repetidas", () => {
    expect(isValidCNPJ("00000000000000")).toBe(false);
    expect(isValidCNPJ("11111111111111")).toBe(false);
    expect(isValidCNPJ("99999999999999")).toBe(false);
  });
});

describe("hasCNPJLength", () => {
  it("aceita 14 dígitos independente de DV", () => {
    expect(hasCNPJLength("11222333000182")).toBe(true);
    expect(hasCNPJLength("00000000000000")).toBe(true);
  });
  it("rejeita comprimento errado", () => {
    expect(hasCNPJLength("123")).toBe(false);
    expect(hasCNPJLength(null)).toBe(false);
  });
});

describe("formatCNPJ", () => {
  it("formata CNPJ com 14 dígitos", () => {
    expect(formatCNPJ("11222333000181").formatted).toBe("11.222.333/0001-81");
    expect(formatCNPJ("11222333000181").valid).toBe(true);
  });
  it("retorna inválido para comprimento errado", () => {
    expect(formatCNPJ("123").valid).toBe(false);
  });
});

describe("maskCNPJ", () => {
  it("aplica máscara progressivamente", () => {
    expect(maskCNPJ("11")).toBe("11");
    expect(maskCNPJ("112")).toBe("11.2");
    expect(maskCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });
});
