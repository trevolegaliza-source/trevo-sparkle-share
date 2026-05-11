# 08 — Financeiro (`/financeiro`)

> Arquivo: `src/pages/Financeiro.tsx` (931 linhas) + `ClienteAccordionFinanceiro.tsx` (2300+ linhas)

## 🎯 O que é

Hub financeiro. 3 abas + KPIs + filtro de período + auditoria embutida.

**Permissão:** `modulo='financeiro'`. Master, gerente, financeiro veem. Operacional NÃO vê (correto).

## 🗺️ Mapa

```
┌──────────────────────────────────────────────────────────────┐
│ Financeiro                                  [📥 Export CSV] │
│ Período: [Este Mês ▾] (este_mes / mes_anterior / ultimos_3 / custom)│
├──────────────────────────────────────────────────────────────┤
│ KPIs (5 GlassCards):                                          │
│ [A Fazer 5] [Em Andamento 3] [Pagas 12] [Em Atraso 2] [Resultado +R$X]│
├──────────────────────────────────────────────────────────────┤
│ Abas: [⏳ A Fazer] [🔵 Em Andamento] [✅ Histórico]           │
├──────────────────────────────────────────────────────────────┤
│ Cada aba mostra Accordion por Cliente, agrupando lançamentos │
└──────────────────────────────────────────────────────────────┘
```

## 🔬 Aba "A Fazer"

Sub-seções:
- **Aguardando Auditoria** — lancamentos `auditado=false`
- **Auditados — Prontos para cobrar** — `auditado=true` mas sem extrato
- **Contestados** — caso especial (cliente contestou cobrança)
- **Aguardando Deferimento** — clientes `no_deferimento` esperando deferir

**Achado UX-104 🟡:** abas "A Fazer"/"Em Andamento"/"Histórico" são opacas. Master que entra pela primeira vez não sabe a diferença sem clicar uma a uma. Sugestão: tooltip ou contagem mais clara em cada uma.

## 🔬 Aba "Em Andamento"

Sub-seções:
- **Cobrança Gerada** — extrato gerado, ainda não enviada
- **Cobrança Enviada** — link enviado, aguardando pagamento
- **Vencidas** — passou da data

UX-018 (routing inconsistente) afeta aqui: alguns alertas do Dashboard caem nessa aba via `state`, outros via `?tab`.

## 🔬 Aba "Histórico"

- **Pagos no período** — REL-012 fixado hoje (filtra por `data_pagamento`)
- **Ranking pagadores** — top clientes por valor pago
- **Buscar no histórico** — tabela com todos os lançamentos do período

UX-009 (devolver pra auditoria com seleção) atua aqui também.

## 🔬 KPIs no header
- **A Fazer** — N lancamentos aguardando auditoria
- **Em Andamento** — N em cobrança ativa (clica → aba em_andamento)
- **Pagas** — N pagas no período (clica → aba historico)
- **Em Atraso** — N vencidas
- **Resultado** — Receita - Despesas do mês (positivo verde, negativo vermelho)

**Achado UX-105 🟢:** KPI "Resultado" colspan-2-lg:col-1 — em desktop fica destaque, em mobile some pra última posição. OK responsivo.

## 🔬 Export CSV (handleExportCSV)
- Gera CSV dos lancamentos do período
- ✅ útil pra batch externo

## 🐛 Achados

| ID | Severidade | Problema |
|---|---|---|
| **REL-012** | ✅ fixado hoje | Filtro Pagos por `data_pagamento` |
| **UX-009** | ✅ fixado hoje | Voltar pra Auditoria com seleção |
| **UX-014** | 🔴 (mapeado) | Dialog "Marcar Faturado" lê state vs param |
| **UX-104** | 🟡 | Abas opacas sem tooltip |
| **REL-014** | 🔴 (mapeado) | `executarGeracaoExtrato` 5 awaits silenciosos |
| **FEAT-004** | 🔴 (mapeado) | 3 caminhos de marcar pago |

## 🚦 Verdict release

**🟢 GO.** Tela funciona — Letícia vai usar muito mas o fluxo está OK. Os achados restantes (UX-014, REL-014, FEAT-004) são pra batch de polish pós-release.

Recomendação: Letícia treina no `/financeiro → Histórico` no primeiro dia. Erros em outras abas são reverdíveis via UX-009 (devolver pra auditoria) que já está fixado.
