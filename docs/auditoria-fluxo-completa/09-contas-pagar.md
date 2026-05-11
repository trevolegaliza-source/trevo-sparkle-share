# 09 — Contas a Pagar (`/contas-pagar`)

> Arquivo: `src/pages/ContasPagar.tsx` (776 linhas)

## 🎯 O que é

Gestão de despesas. Cadastro de contas a pagar, pagamento, anexo de comprovante.

**Permissão:** `modulo='contas_pagar'`. Master, gerente, financeiro veem.

## 🗺️ Mapa

```
┌────────────────────────────────────────────────────────┐
│ Contas a Pagar                          [+ Nova Conta] │
│ KPIs: [Pendente] [Vencidas] [Pagas mês]                │
│ Filtros: Período | Categoria | Fornecedor              │
│                                                         │
│ Tabela: Descrição | Categoria | Vencimento | Valor | Status | [⋯]│
└────────────────────────────────────────────────────────┘
```

## 🔬 Achados

### Nova conta — modal
Campos: descrição, valor, vencimento, categoria, recorrência (mensal/único).

**Achado UX-106 🟡:** sem split de valor (ex: parcela cartão divididas em 12x precisa criar 12 entradas separadas).

### Recorrência
Via `despesas_recorrentes`. Sistema gera lancamento automático no dia X.

**Achado UX-107 🟢:** não tem visualização clara de "qual conta é recorrente" no listing. Considere badge "↻".

### Marcar pago / Editar pagamento / Comprovante
3 caminhos no `ContasPagarLista.tsx:175-180`:
- `onClick={() => onMarcarPago(l)}` (linha 175) — `<CreditCard>` "Marcar pago"
- `onClick={() => onMarcarPago(l)}` (linha 180) — `<Edit>` "Editar pagamento / comprovante"

**Achado UX-108 🟢:** ambos chamam mesma função. UI tem 2 botões fazendo a mesma coisa com tooltip diferente. Confuso. Consolidar.

### Subir comprovante
Upload PDF/JPG/PNG no storage. ✅

**Achado UX-109 🟢:** sem preview do comprovante na lista — só ícone "anexo OK". Hover ou click pra ver.

### Cartão (relacionamento)
Despesa pode ser vinculada a um `cartao_compras`. Aí aparece em `/cartao/:id`.

**Achado UX-110 🟡 (= PERM-008):** se cartões viram multi-tenant, contas vinculadas a cartão de outra empresa aparecem. RLS de `cartao_compras` é permissivo (PERM-008).

## 🚦 Verdict release

**🟡 ATENÇÃO** — funciona mas tem detalhes. Letícia (gerente) provavelmente vai usar aqui pra controlar despesas operacionais.

Recomendação: testar pré-release com a Letícia 5min — cadastrar 1 conta, marcar paga, anexar comprovante. Ver se UI flui sem dúvida.
