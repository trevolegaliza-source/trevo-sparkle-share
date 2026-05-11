# 10 — Cartões (`/cartao`, `/cartao/:id`)

> Arquivos: `src/pages/Cartao.tsx` (312 linhas), `src/pages/CartaoDetalhe.tsx`

## 🎯 O que é

Gestão de cartões corporativos da empresa. Cadastro, compras, faturas mensais.

**Permissão:** `modulo='contas_pagar'` (mesma de Contas a Pagar — discutível).

⚠️ **CRÍTICO — PERM-008.** As 3 tabelas relacionadas (`cartoes`, `cartao_compras`, `cartao_faturas`) tem RLS permissivo (`qual='true'`). Hoje 1 empresa — OK. Multi-tenant futuro: vazamento total.

## 🗺️ Mapa

`/cartao` (lista):
```
┌──────────────────────────────────────────────────┐
│ Cartões                          [+ Novo Cartão] │
│ [Card 1] Visa final 4567   Limite R$10k          │
│ [Card 2] Master final 9999 Limite R$50k          │
└──────────────────────────────────────────────────┘
```

`/cartao/:id` (detalhe):
- Compras do mês
- Faturas fechadas e abertas
- Pagamento da fatura (vincula a `lancamentos`)

## 🔬 Achados

### Compras (`cartao_compras`)
- Cadastro com descrição, valor, data, parcelas, fornecedor
- Pode dividir 1 compra em N parcelas (criando N faturas)

**Achado UX-111 🟢:** UI de "parcelar" é OK, mas calcular juros ou dividir desigual (R$100 em 3x = 33,33+33,33+33,34) não está claro.

### Faturas
- Fechamento automático no dia X
- Vincula a lancamento "Pagar Fatura Cartão X"
- Marcar paga → lancamento marcado pago

**Achado UX-112 🟢:** sem visualização "extrato consolidado" do cartão (PDF tipo Nubank). Letícia que controla pode gostar.

## 🐛 Crítico

| ID | Severidade |
|---|---|
| **PERM-008** | 🔴 (mapeado em ANEXO-A) — RLS permissivo nas 3 tabelas |

## 🚦 Verdict release

**🟢 GO** com nota PERM-008 pra próxima sessão (multi-tenant).

Hoje a Letícia opera o cartão da empresa única — sem risco real. Pré-release: testar cadastrar 1 compra + pagar fatura.
