import { describe, it, expect } from "vitest";
import { canSeeNotificacao } from "./notificacao-filter";

const master = { isMaster: true, podeVerFinanceiro: true, podeVerOrcamentos: true };
const gerente = { isMaster: false, podeVerFinanceiro: false, podeVerOrcamentos: true };
const operacional = { isMaster: false, podeVerFinanceiro: false, podeVerOrcamentos: false };
const financeiroSemOrc = { isMaster: false, podeVerFinanceiro: true, podeVerOrcamentos: false };

describe("canSeeNotificacao — master vê tudo", () => {
  it("master vê cobrança", () => {
    expect(canSeeNotificacao({ tipo: "cobranca", orcamento_id: null }, master)).toBe(true);
  });
  it("master vê pagamento", () => {
    expect(canSeeNotificacao({ tipo: "pagamento", orcamento_id: null }, master)).toBe(true);
  });
  it("master vê aprovação de novo usuário (sem orcamento_id)", () => {
    expect(canSeeNotificacao({ tipo: "aprovacao", orcamento_id: null }, master)).toBe(true);
  });
  it("master vê login_novo (SEC-025)", () => {
    expect(canSeeNotificacao({ tipo: "login_novo", orcamento_id: null }, master)).toBe(true);
  });
});

describe("canSeeNotificacao — gerente NÃO vê financeiro", () => {
  it("gerente NÃO vê cobranca", () => {
    expect(canSeeNotificacao({ tipo: "cobranca", orcamento_id: null }, gerente)).toBe(false);
  });
  it("gerente NÃO vê pagamento", () => {
    expect(canSeeNotificacao({ tipo: "pagamento", orcamento_id: null }, gerente)).toBe(false);
  });
  it("gerente vê aprovacao de orçamento (com orcamento_id)", () => {
    expect(canSeeNotificacao({ tipo: "aprovacao", orcamento_id: "abc" }, gerente)).toBe(true);
  });
  it("gerente NÃO vê aprovacao de novo usuário (sem orcamento_id)", () => {
    expect(canSeeNotificacao({ tipo: "aprovacao", orcamento_id: null }, gerente)).toBe(false);
  });
  it("gerente vê recusa de orçamento", () => {
    expect(canSeeNotificacao({ tipo: "recusa", orcamento_id: "abc" }, gerente)).toBe(true);
  });
  it("gerente NÃO vê login_novo", () => {
    expect(canSeeNotificacao({ tipo: "login_novo", orcamento_id: null }, gerente)).toBe(false);
  });
});

describe("canSeeNotificacao — operacional NÃO vê quase nada", () => {
  it("operacional NÃO vê cobranca", () => {
    expect(canSeeNotificacao({ tipo: "cobranca", orcamento_id: null }, operacional)).toBe(false);
  });
  it("operacional NÃO vê aprovacao de orçamento", () => {
    expect(canSeeNotificacao({ tipo: "aprovacao", orcamento_id: "abc" }, operacional)).toBe(false);
  });
  it("operacional NÃO vê login_novo", () => {
    expect(canSeeNotificacao({ tipo: "login_novo", orcamento_id: null }, operacional)).toBe(false);
  });
});

describe("canSeeNotificacao — financeiro vê só do escopo dele", () => {
  it("financeiro vê cobranca + pagamento", () => {
    expect(canSeeNotificacao({ tipo: "cobranca", orcamento_id: null }, financeiroSemOrc)).toBe(true);
    expect(canSeeNotificacao({ tipo: "pagamento", orcamento_id: null }, financeiroSemOrc)).toBe(true);
  });
  it("financeiro NÃO vê aprovacao de orçamento (sem podeVerOrcamentos)", () => {
    expect(canSeeNotificacao({ tipo: "aprovacao", orcamento_id: "abc" }, financeiroSemOrc)).toBe(false);
  });
  it("financeiro NÃO vê login_novo", () => {
    expect(canSeeNotificacao({ tipo: "login_novo", orcamento_id: null }, financeiroSemOrc)).toBe(false);
  });
});
