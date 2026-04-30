# 🔥 AUDITORIA GROTESCA — TREVO ERP

> **Doc vivo.** Atualizado a cada commit. Última atualização: 30/04/2026.
> Auditoria original disparada pelo Thales: *"AUDITORIA COMPLETAMENTE GROSTESCA NESSE ERP! MAS GROTESCA MESMO OK?"*

---

## 📊 Painel

| Categoria | Total identificado | Resolvido | Pendente |
|---|---|---|---|
| 🔴 Crítico (C1-C27) | 27 | 9 | 18 |
| 🟠 Importante | ~80* | 0 | ~80 |
| 🟡 Atenção | ~50* | 0 | ~50 |
| 🟢 Features sugeridas | ~18* | 0 | ~18 |

*\*Contagens de "Importante", "Atenção" e "Features" são estimativas — a lista
completa estava na auditoria pré-compact e precisa ser reconstruída em
sessão dedicada (ver bloco "Reconstruir auditoria completa" no fim).*

---

## ✅ FECHADOS — sessão noturna 30/04/2026

| ID | Item | Commit |
|---|---|---|
| C6 | Frontend bloqueia saldo pré-pago negativo | [`6eb1a31`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6eb1a31) |
| C8 | Timezone bug em `isLancamentoVencidoReal` | [`6eb1a31`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6eb1a31) |
| C9 | Validação CNPJ mod-11 (DV + sequências repetidas) | [`6eb1a31`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6eb1a31) |
| C10 | NaN guard em `calcularDescontoProgressivo` | [`6eb1a31`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6eb1a31) |
| C16 | TTL + amarração ao user.id no `getEmpresaId` cache | [`2fd5f28`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/2fd5f28) |
| C19 | `confirm()` → `AlertDialog` em Catalogo (delete topo) | [`2fd5f28`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/2fd5f28) |
| C20 | `confirm()` → `AlertDialog` em Catalogo (modal serviço) | [`2fd5f28`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/2fd5f28) |
| C21 | NotFound em PT-BR + botões Voltar/Dashboard | [`6f10352`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6f10352) |
| C23 | ESLint `no-unused-vars` `off` → `warn` | [`75504d3`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/75504d3) |
| C25 | README real (stack, scripts, estrutura, deploy) | [`6f10352`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6f10352) |
| C26 | GitHub Actions CI (lint+typecheck+test+build) | [`6f10352`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6f10352) |

**11 itens fechados** (alguns originalmente listados como C-único cobriam múltiplos sub-itens).

---

## 🔴 CRÍTICOS PENDENTES

### Backend / banco — exigem acesso Supabase
- **C1** — RLS auditing: rodar `pg_policies` completo no projeto novo `aahhauquuicvtwtrxyan` e validar isolamento por `empresa_id` em **toda** tabela.
- **C2** — Storage buckets: validar policies adicionais (`recibos`, `propostas`, etc.) além das 4 já mapeadas (`contestacoes`, `contratos`, `documentos` + INSERT genérico).
- **C3** — Service_role key: confirmar onde ainda é usada e se aparece em logs.
- **C4** — Edge functions sem rate limit: revisar todas as 13 funções.

### Prompt injection na Dani — DEFERIDOS pelo Thales (28/04)
- **C5** — Sanitização de input do cliente antes de mandar pra Claude.
- **C12** — Outro vetor de injection no fluxo de análise.

### Lógica financeira / RPCs Postgres
- **C7** — Idempotência do webhook Asaas em retries simultâneos (lock).
- **C11** — Atomicidade do desconto de boas-vindas (já tratado em RPC, mas merece teste end-to-end).
- **C13** — Reconciliação Trello: divergências silenciosas.
- **C14** — DRE: cálculo de impostos não-modulado.
- **C15** — Fluxo de caixa: projeções não consideram parcelamento.

### UX / repo / TS
- **C17** — Error boundaries por rota (hoje só StrictMode).
- **C18** — Telemetria de erros (Sentry/equivalente).
- **C22** — TS strict mode (~250 erros previsíveis, lote dedicado).
- **C24** — Test coverage baseline (hoje só 1 teste exemplo + cnpj.test).
- **C27** — Bundle size analysis + code splitting por rota.

### `confirm()` ainda nativos (4 arquivos)
- `src/components/financeiro/DetalhesCobrancaModal.tsx`
- `src/components/financeiro/ClienteAccordionFinanceiro.tsx`
- `src/components/contas-pagar/MarcarPagoModal.tsx`
- `src/components/configuracoes/PlanoContasTab.tsx`

(Originalmente parte do C19+C20; sub-itens espalhados em fluxos financeiros — exigem teste UI manual antes de mexer.)

---

## 🟠 IMPORTANTES — a reconstruir

A lista detalhada (~80 itens) ficou na auditoria pré-compact. Categorias
mapeadas:
- Validações de form (Zod incompleto em vários cadastros)
- Loading states inconsistentes (alguns botões sem `disabled` durante mutation)
- A11y (aria-labels, foco em modais, contraste)
- Datas exibidas em formatos diferentes em telas diferentes
- Mensagens de erro genéricas em hooks Supabase

> **Ação:** quando o Thales pedir, faço re-auditoria de Importantes em sessão dedicada com agentes Explore.

## 🟡 ATENÇÃO — a reconstruir

Mesma situação. Categorias:
- Comentários em inglês misturado com PT-BR
- Imports não usados (agora pegáveis via ESLint warn — C23 ✅)
- Componentes >500 linhas (Catalogo, ClienteDetalhe)
- Mágicos numerais sem const

## 🟢 FEATURES SUGERIDAS — a reconstruir

(~18 itens) — categorias lembradas:
- Dark mode toggle
- Atalhos de teclado globais
- Busca global (cmd+k)
- Export CSV em mais relatórios
- Histórico de alterações por entidade

---

## 🏗️ Reconstruir auditoria completa

Quando o Thales pedir:

> "Re-auditoria completa do Importantes/Atenção/Features"

Eu:
1. Disparo 4 agentes Explore em paralelo: Frontend, Hooks, Edge Functions, Banco/RLS.
2. Cada um devolve issues com `file_path:line` exato.
3. Consolido aqui com novos IDs (`I001+`, `A001+`, `F001+`).
4. Commit como nova seção.

---

## 📋 Regra do doc

**Toda vez que eu (Claude) faço commit no `trevo-sparkle-share`:**
1. Atualizo a tabela "Painel" (totais).
2. Movo itens de "Pendentes" pra "Fechados" com link do commit.
3. Adiciono novos itens descobertos durante a sessão.
4. Commito este `.md` junto (ou logo em seguida).

---

## 📜 Histórico de sessões

| Data | Sessão | Commits | Itens fechados |
|---|---|---|---|
| 30/04/2026 madrugada | Lotes A/B/C/D + ESLint + relatório | 5 | C6, C8, C9, C10, C16, C19, C20, C21, C23, C25, C26 |
