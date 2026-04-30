# 🔥 AUDITORIA GROTESCA — TREVO ERP

> **Doc vivo.** Atualizado a cada commit. Última atualização: 30/04/2026 noite (Lote H — UI/UX).
> Auditoria original disparada pelo Thales: *"AUDITORIA COMPLETAMENTE GROSTESCA NESSE ERP! MAS GROTESCA MESMO OK?"*

---

## 📊 Painel

| Categoria | Total identificado | Resolvido | Pendente |
|---|---|---|---|
| 🔴 Crítico (C1–C27 originais) | 27 | 13 | 14 |
| 🔴 Crítico novo (C28+) — descoberto na re-auditoria 30/04 | 23 | 4 | 19 |
| 🟠 Importante (I001+) | 42 | 0 | 42 |
| 🟡 Atenção (A001+) | 30 | 0 | 30 |
| 🟢 Features sugeridas (F001+) | 19 | 0 | 19 |

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
| C17 | Error Boundary global (class component PT-BR + reset/home) | [`9a8e215`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/9a8e215) |
| C27 | Code splitting por rota (React.lazy) — já existia, confirmado em `App.tsx` | [`9a8e215`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/9a8e215) |
| C36 | timing-safe compare em verify-master-password — **já estava** no worktree TREVO-ENGINE/hungry-tu (audit fix #2 anterior). Agente auditou main desatualizado. | (pré-existente) |
| C37 | CORS allowlist em `asaas-webhook` — **já estava** no worktree (audit fix #21 anterior, via `_shared/cors.ts`) | (pré-existente) |
| C38 | CORS allowlist em `verify-master-password` — **já estava** no worktree (audit fix #21) | (pré-existente) |
| C41 | Validação de payload (UUID + ISO date) em `asaas-gerar-cobranca` | [`c5d4d39`](https://github.com/trevolegaliza-source/v10-erp-trevo-legaliza/commit/c5d4d39) (TREVO-ENGINE / claude/hungry-tu) |

**17 itens fechados** (4 do Lote F: 3 já estavam no worktree + C41 novo).
**Bônus do Lote E (`9a8e215`):** limpeza de imports não usados em ~30 arquivos.

---

## 🔴 CRÍTICOS PENDENTES — originais (C1–C27)

### Backend / banco — exigem acesso Supabase
- **C1** — RLS auditing: rodar `pg_policies` completo no projeto novo `aahhauquuicvtwtrxyan` e validar isolamento por `empresa_id` em **toda** tabela. *(ver C28–C32 com evidência)*
- **C2** — Storage buckets: validar policies adicionais. *(ver C33)*
- **C3** — Service_role key: confirmar onde ainda é usada.
- **C4** — Edge functions sem rate limit: revisar todas as 13 funções. *(ver C39–C40)*

### Prompt injection na Dani — DEFERIDOS pelo Thales (28/04)
- **C5** — Sanitização de input do cliente antes de mandar pra Claude.
- **C12** — Outro vetor de injection no fluxo de análise.

### Lógica financeira / RPCs Postgres
- **C7** — Idempotência do webhook Asaas em retries simultâneos.
- **C11** — Atomicidade do desconto de boas-vindas.
- **C13** — Reconciliação Trello: divergências silenciosas.
- **C14** — DRE: cálculo de impostos não-modulado.
- **C15** — Fluxo de caixa: projeções não consideram parcelamento.

### UX / repo / TS
- **C18** — Telemetria de erros (Sentry/equivalente).
- **C22** — TS strict mode (~250 erros previsíveis, lote dedicado).
- **C24** — Test coverage baseline.

### `confirm()` ainda nativos (4 arquivos)
- `src/components/financeiro/DetalhesCobrancaModal.tsx`
- `src/components/financeiro/ClienteAccordionFinanceiro.tsx`
- `src/components/contas-pagar/MarcarPagoModal.tsx`
- `src/components/configuracoes/PlanoContasTab.tsx`

---

## 🔴 CRÍTICOS NOVOS — descobertos em 30/04 (C28+)

### Banco / RLS / Storage (estende C1, C2)
- **C28** — RLS `clientes_all` USING(true) WITH CHECK(true) — cross-tenant aberto. `supabase/migrations/20260319023436_*.sql:51`
- **C29** — RLS `processos_all` USING(true) — idem. `…20260319023436_*.sql:70`
- **C30** — RLS `lancamentos_all` USING(true). `…20260319023436_*.sql:124`
- **C30b** — Mesmo pattern em `documentos` (linha 83), `valores_adicionais` (linha 138), `precos_tiers` (linha 153). `supabase/migrations/20260319023436_*.sql`
- **C31** — RLS `cobrancas_authenticated_all` USING(true). `…20260420202106_*.sql:12`
- **C32** — RLS `extratos_authenticated_all` + `orcamentos_authenticated_all` USING(true). `…20260327191243_*.sql:22`, `…20260328193418_*.sql:35`
- **C33** — Storage bucket `documentos` policies só checam `bucket_id`, **sem filtrar tenant**. `…20260319023436_*.sql:228-235`
- **C34** — FK sem ON DELETE: `extratos.cliente_id`, `orcamentos.cliente_id`, `profiles.convidado_por`, `lancamentos.cliente_id`/`processo_id` — dados órfãos.
- **C35** — `handle_new_user()` cria profile com `empresa_id = gen_random_uuid()` → cada user em tenant próprio (quebra multi-tenant intencional). `…20260331114056_*.sql:27-35`

### Edge functions (estende C4)
- ~~**C36**~~ ✅ FECHADO (já estava no worktree).
- ~~**C37**~~ ✅ FECHADO (CORS allowlist no worktree).
- ~~**C38**~~ ✅ FECHADO (CORS allowlist no worktree).
- **C39** — Hardcoded master user `MASTER_USER = "trevolegaliza"`. `…/trello-guard/index.ts:9` *(precisa Thales setar env var no Supabase)*
- **C40** — Token Asaas em query string (`?token=`). `…/dani-webhook-proxy/index.ts:69` *(BLOQUEADO: Apps Script strippa headers customizados; mover pro body exige mexer também no handler Apps Script — cross-repo)*
- ~~**C41**~~ ✅ FECHADO em [`c5d4d39`](https://github.com/trevolegaliza-source/v10-erp-trevo-legaliza/commit/c5d4d39).

### Hooks / lógica financeira (estende C7, C11)
- **C42** — UPDATE saldo_prepago + INSERT prepago_movimentacoes sem transação. `src/hooks/useFinanceiro.ts:509-519`
- **C43** — DELETE cascata `lancamentos` apaga histórico financeiro irreversível. `src/hooks/useProcessos.ts:64-74`
- **C44** — `existingMap` lookup por subcategoria vazia colapsa key (upsert silencioso falha se 2 verbas mesma subcategoria). `src/lib/gerar-verbas.ts:246-257`
- **C45** — Race condition boas-vindas: fallback manual no catch pode não ser alcançado se exceção ≠ network. `src/hooks/useFinanceiro.ts:415-427`
- **C46** — `useAlterarValorLancamento` sem `onError` — falha silenciosa em alteração de valor. `src/hooks/useFinanceiroClientes.ts:200`
- **C47** — `Number(o.valor_final)` sem proteção parseFloat → NaN se NULL. `src/hooks/useOrcamentos.ts:87`
- **C48** — `useContasPagar.create` payload `Record<string, any>` + `as any` — sem validação valor/data. `src/hooks/useContasPagar.ts:82-83`
- **C49** — `useCreateLancamento` `onSuccess` não invalida todas queries dependentes. `src/hooks/useFinanceiro.ts:620`

---

## 🟠 IMPORTANTES (I001+)

### Frontend / páginas
- **I001** — `parseInt(localStorage.getItem(...))` sem guard NaN. `src/pages/Dashboard.tsx:44-48`, `src/pages/ContasPagar.tsx:138`
- **I002** — Magic number `86400000` (ms/dia) sem const, repetido 10+ vezes. `src/pages/Clientes.tsx:72`, `…ContasPagar.tsx:686`
- **I003** — `cliente as any` cast abusivo em rotina inteira. `src/pages/ClienteDetalhe.tsx:195`
- **I004** — `parseFloat(e.target.value)` sem guard NaN em forms. `src/pages/OrcamentoNovo.tsx:787`, `…CobrancaPublica.tsx:296`
- **I005** — `Number(valorExibir).toLocaleString()` sem guard null/undefined. `src/pages/Clientes.tsx:378-381`
- **I006** — `lancamento.data_vencimento` assumido sempre ISO sem parsing seguro. `src/pages/Processos.tsx:34-48`
- **I007** — `parseFloat(novoValor.replace(',', '.'))` assume vírgula — quebra se user digitar ponto. `src/pages/ClienteDetalhe.tsx:2407`
- **I008** — `friendlyAuthError()` fallback genérico "Erro desconhecido" em PT mas mapas em EN. `src/pages/Login.tsx:49-64`
- **I009** — `useEffect` sem dependency array em `checkMensalistas`. `src/pages/Dashboard.tsx:82-112`
- **I010** — Toast.info("Processo ocultado") — feature incompleta no menu. `src/pages/Processos.tsx:75-76`
- **I011** — `Tooltip` sem `aria-label` em ícones. `src/pages/Clientes.tsx:322-340`
- **I012** — Map sem null check em `pagamentoStatusMap`. `src/pages/Processos.tsx:203-209`
- **I013** — `.map()` sem `key` (renderiza por index). `src/pages/CadastroRapido.tsx:255`
- **I014** — `R$ ${valor.toLocaleString()}` inline em toast (sem helper). `src/pages/Dashboard.tsx:196`
- **I015** — `valorVencido.toLocaleString()` sem guard se reducer der `undefined`. `src/pages/Financeiro.tsx:196`
- **I016** — `venc.getTime()` sem null check. `src/pages/ContasPagar.tsx:686`
- **I017** — Webhook config sem validação de URL (SSRF potencial). `src/pages/Configuracoes.tsx:46-67`

### Hooks / lib
- **I018** — `queryKey` `'financeiro_clientes'` string em vez de array (inconsistência). `src/hooks/useFinanceiroClientes.ts:121-126`
- **I019** — `Record<string, ValorAdicionalSimple[]>` sem limite de tamanho — OOM em 10k+ valores. `src/hooks/useContasReceber.ts:75`
- **I020** — `calcularDRE()` sem guard NaN/Infinity (margemBruta, margemLiquida 0/0). `src/hooks/useDRE.ts:87-135`
- **I021** — `calcularDescontoProgressivo()` iteração não-clampada (loop 999×). `src/hooks/useFinanceiro.ts:237-264`
- **I022** — `useMarcarPagoBulk()` `.neq+ .in` duplo filtro (planner ineficiente). `src/hooks/useContasPagar.ts:209-245`
- **I023** — `useDashboardStats()` 16+ queries Supabase em mutação sem rate-limit. `src/hooks/useDashboard.ts:36-271`
- **I024** — `staleTime: 5min` mas mutations invalidam indefinidamente. `src/hooks/useFinanceiroClientes.ts:407,509`
- **I025** — RLS `not(..., 'in', ...)` com etapa string sem sanitização explícita. `src/hooks/useProcessos.ts:99-182`

### Edge functions
- **I026** — `asaas-webhook` sem retry com backoff exponencial.
- **I027** — `provisionar-cliente-trello` `fetch` sem `AbortController`. `…/provisionar-cliente-trello/index.ts:86-93`
- **I028** — `asaas-gerar-cobranca` fetch Asaas sem timeout. `…/asaas-gerar-cobranca/index.ts:38-50`
- **I029** — Logs expõem `body.substring(0, 500)` (dados sensíveis). `…/asaas-gerar-cobranca/index.ts:55-60`
- **I030** — `create-user` sem rate limit (DoS interno via spam). `…/create-user/index.ts`
- **I031** — Configuracoes `if (data)` sem log de erro silencia falhas. `src/pages/Configuracoes.tsx:33-44`
- **I032** — `paymentId` em URL query (vai pra logs HTTP). `…/asaas-gerar-cobranca/index.ts:150`
- **I033** — Service role key + APPS_SCRIPT_TOKEN em `dani-webhook-proxy` desnecessárias. `…/dani-webhook-proxy/index.ts:53-54`

### Banco / migrations
- **I034** — `processos.etapa TEXT` sem `CHECK(etapa IN (...))`. `…20260319023436_*.sql:59`
- **I035** — `lancamentos.etapa_financeiro TEXT` sem CHECK. `…20260319023436_*.sql:111`
- **I036** — `documentos.status TEXT` sem CHECK. `…20260319023436_*.sql:130-131`
- **I037** — `NUMERIC(12,2)` em monetários (deveria ser `NUMERIC(14,2)`). `…20260319023436_*.sql:34,35,36,38,62,104,112`
- **I038** — `DROP COLUMN extratos.created_by` duplicado em 2 migrations (idempotência quebrada). `…20260422162444_*.sql:49`, `…20260422140000_*.sql:103`
- **I039** — `CREATE TABLE empresas_config` duplicado em 2 migrations. `…20260422162656_*.sql` vs `…20260422150000_*.sql`
- **I040** — Tipagem fraca em responses de edge functions (`{ valid }` sem type explícito).
- **I041** — Logs estruturados ausentes (sem JSON com `level`/`timestamp`/`context`) em todas as edge functions.
- **I042** — `useDashboard()` recalcula `new Date(now.getTime() - 30 * 86400000).toISOString()` toda render. `src/hooks/useDashboardData.ts:45`

---

## 🟡 ATENÇÃO (A001+)

### Componentes gigantes (>500 linhas)
- **A001** — `src/pages/ClienteDetalhe.tsx` — **2519 linhas**, tabs 6+ seções, 15+ modais inline
- **A002** — `src/components/financeiro/ClienteAccordionFinanceiro.tsx` — **2256 linhas** (extrato + WhatsApp + Asaas + PDF + email)
- **A003** — `src/pages/OrcamentoNovo.tsx` — **1253 linhas** (1 form gigante com 5+ modos)
- **A004** — `src/pages/Catalogo.tsx` — **1057 linhas** (navegação + CRUD + admin tudo junto)
- **A005** — `src/components/financeiro/ClientesAuditoria.tsx` — **969 linhas**
- **A006** — `src/pages/ContasPagar.tsx` — **745 linhas** (múltiplos tabs + KPIs + bulk)
- **A007** — `src/hooks/useFinanceiro.ts` — **>700 linhas** (precificação distribuída em 3+ funções)
- **A008** — `src/hooks/useFinanceiroClientes.ts` — **>700 linhas** (duplicação de invalidações)

### Migrations grandes
- **A009** — `…20260422160000_audit_trail_financeiro.sql` — **330 linhas** (tabela + 3 triggers + 2 funções + policies em 1 arquivo)
- **A010** — `…20260422121545_*.sql` — **248 linhas** (refactor via_analise + lancamentos + cobrancas)
- **A011** — `…20260422224928_*.sql` — **247 linhas** (refactor reaplicar_via_analise)
- **A012** — `asaas-gerar-cobranca` — **366 linhas** (customer + payment + PIX + lock + erro tudo junto)
- **A013** — `asaas-webhook` — **377 linhas** (6 tipos de evento, sem helpers)

### Magic numbers / consts inline
- **A014** — `"00.000.000/0000-00"` placeholder CNPJ hardcoded. `src/pages/ClienteDetalhe.tsx:1482`
- **A015** — `MESES_NAV` / `DIAS_SEMANA` arrays inline em FC (mover pra const externa). `src/pages/ContasPagar.tsx:58-60`
- **A016** — `fmt()` BRL formatter redeclarado em 8+ arquivos (Dashboard, Catalogo, ContasPagar, InteligenciaGeografica, etc).

### Lógica nidada / strategy faltante
- **A017** — Precificação `if/else` profundo (isAvulso → isPrePago → isMensalista). `src/hooks/useFinanceiro.ts:288-402`
- **A018** — `aplicarAumentos()` modifica array + UPDATE DB sem rollback se falha mid-loop. `src/lib/gerar-verbas.ts:195-212`
- **A019** — `isVtVrSub()` case-insensitive em subcategoria sem validação de schema DB. `src/hooks/useContasPagar.ts:127-133`

### UX / a11y
- **A020** — Loading skeleton ausente em ClienteDetalhe durante busca CEP/coordinates. `src/pages/ClienteDetalhe.tsx:403-530`
- **A021** — Tooltip com `aria-label` faltando em action icons (Trash, Download, Eye, Edit) em accordions/tabelas
- **A022** — Datas em `weekday: 'long'` inline em h1 sem helper. `src/pages/Dashboard.tsx:321`
- **A023** — Comentários PT/EN misturados ("// audit fix #31" PT, "/* ignore */" EN espalhados)
- **A024** — `new Date()` sem `setHours(0,0,0,0)` em comparações (edge case midnight). `src/pages/Dashboard.tsx:321`

### Banco
- **A025** — Multi-tenant incompleto: `empresas_config` existe sem retrofit `ADD COLUMN empresa_id` em clientes/processos/lancamentos. `…20260422150000_*.sql`
- **A026** — Soft delete `is_archived` sem policy default que filtre `WHERE is_archived = false`.
- **A027** — Falta `COMMENT ON COLUMN` em colunas não-óbvias (`momento_faturamento`, `desconto_progressivo_limite`).
- **A028** — Comentário do `useProcessos.delete` diz que evita FK, mas continua deletando lancamentos. `src/hooks/useProcessos.ts:64-74`
- **A029** — Tipagem fraca de response em `verify-master-password` (`{ valid }` sem schema). `…/verify-master-password/index.ts:75`
- **A030** — `useDashboardStats()` e `useDashboard()` ambos derivam mes/ano de `new Date()` sem param.

---

## 🟢 FEATURES SUGERIDAS (F001+)

- **F001** — Dark mode toggle (CSS já suporta `var(--background)`, falta só botão).
- **F002** — Busca global Cmd+K (cmdk library) no Layout.
- **F003** — Atalho Esc fecha modais; Ctrl+S salva forms.
- **F004** — Skeleton loaders em ClienteDetalhe (hoje "Carregando…" genérico).
- **F005** — Export CSV em ClienteDetalhe (lançamentos, processos) — consistir com Processos/Financeiro.
- **F006** — Audit log automático em Cliente/Lançamentos (hoje só `financeiro_auditoria`).
- **F007** — Validação Zod em Clientes.tsx (hoje validação manual de CNPJ/email/phone).
- **F008** — Loading state "Salvando…" em botões durante mutation (não só `disabled`).
- **F009** — Consolidar `fmt()` BRL helper em `src/lib/format.ts` (parar de redeclarar 8x).
- **F010** — Tooltips com `aria-label` em todos os action icons.
- **F011** — `staleTime: Infinity` em queries imutáveis (useServicos, usePrecosUF, usePlanoContas).
- **F012** — Prefetch detalhe de processo (lancamentos + valores_adicionais paralelo ao abrir modal).
- **F013** — `mutationKey` em upserts (TanStack deduplica requests paralelos idênticos).
- **F014** — `useDashboardStats()` aceitar `mes`/`ano` como param (relatórios passados).
- **F015** — Audit trail automático em clientes/processos/orcamentos (não só financeiro).
- **F016** — Índices compostos `(empresa_id, FK)`: processos.cliente_id, lancamentos.cliente_id, lancamentos.processo_id, documentos.processo_id, valores_adicionais.processo_id.
- **F017** — Soft delete com policy default `WHERE is_archived = false`.
- **F018** — Logger estruturado reutilizável em edge functions.
- **F019** — Refactor edge functions grandes em helpers (`ensureCustomer`, `createPayment`, `fetchQR`).

---

## ✅ ACERTOS encontrados (não-issues, registrar como bom)

- `asaas-webhook` implementa `timingSafeEqual()` customizado.
- `asaas-webhook` idempotência via unique index em `event_id`.
- `asaas-webhook` valida customer match contra PAYMENT_ID forjado.
- `asaas-gerar-cobranca` lock pessimista CAS em `asaas_gerando_lock_ate`.
- `asaas-gerar-cobranca` isola por `empresa_id`.
- `create-user` exige role `master`.
- `verify-master-password` tem rate limit (5/h).
- `trello-guard` HMAC-SHA1 signature verification.
- `get_empresa_id()` blindada com `RAISE EXCEPTION` se NULL (em `…20260422200000_*.sql`).

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
| 30/04/2026 madrugada | Lote E — ErrorBoundary + limpeza imports + confirmação C27 | 1 (`9a8e215`) | C17, C27 |
| 30/04/2026 manhã | Re-auditoria 4 agentes paralelos (Frontend/Hooks/Edge/SQL) | 1 (doc) | — descoberto: 22 críticos novos (C28–C49), 42 importantes, 30 atenção, 19 features |
| 30/04/2026 tarde | Lote F — patches em edge functions (TREVO-ENGINE, branch `claude/hungry-tu`) | 1 (`c5d4d39`) | C41 (+ confirmado C36/C37/C38 já estavam no worktree) |
| 30/04/2026 noite | Cherry-pick C41 → `main` TREVO-ENGINE (sem arrastar Dani v7.10–v7.12.6 da hungry-tu) + verificação compatibilidade frontend (UUID + `<input type=date>` casam com regex) | 1 (`7eea73d`) | C41 em produção pendente deploy do Thales |
| 30/04/2026 noite | Lote G — frontend (trevo-sparkle-share) patches mecânicos | 1 (`4d2205e`) | C46, C47, C19/C20 (6 confirm), C49 |
| 30/04/2026 noite | C43 Fase 1 — Processos.tsx exige senha master pra excluir | 1 (`4403bc6`) | C43 Fase 1 (Fases 2+3 pendentes) |
| 30/04/2026 madrugada | Lote I — Contas a Pagar (VT/VR feriado, Visão 2 colunas, agregação BENEFÍCIOS) | 3 (`75c25d8`, `245ed59`, `7c7d6f9`) | Demandas Thales Cap. 4 |

---

## ✅ CHECKLIST EM ABERTO — ordenado por exequibilidade

### 📋 Demandas do Thales (usabilidade)
*Lista preenchida conforme Thales for passando. Tem prioridade sobre auditoria a partir de 30/04 noite.*

**Análise ERP NOVO entregue 30/04 — `~/ANALISE Thales - ERP NOVO.rtfd`**

- [x] **1.4 / 2.1 / 2.4** — logo Trevo Legaliza atualizado, favicon novo + ícones PWA (16/32/180/192/512). [`6ec34d9`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6ec34d9)
- [x] **2.2** — badges acumulando (95/11/46) removidos da sidebar. [`6ec34d9`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6ec34d9)
- [x] **2.3** — sidebar enxuta (escondidos: Dashboard, Relatórios DRE, Fluxo de Caixa, Intel. Geográfica, Portfólio & Preços, Trello ↔ ERP). Rotas mantidas pra acesso por URL. [`6ec34d9`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6ec34d9)
- [x] **2.5** — sidebar desktop colapsa (w-16 só ícones) e expande no hover (w-60). Mobile mantém hambúrguer. [`6ec34d9`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6ec34d9)
- [x] **1.1** — manifest PWA `start_url` agora aponta pra `/processos` (em vez de Dashboard). [`6ec34d9`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6ec34d9)
- [x] **4.x** — Contas a Pagar VT/VR vencendo em feriado nacional (1/5/2026 → shifta pra 4/5). Mescla feriados hardcoded + BrasilAPI. [`75c25d8`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/75c25d8)
- [x] **4.x** — Contas a Pagar fundiu Urgência+Categoria em "Visão" 2 colunas (Opção C). Aba Lista removida do menu (acessível só via Selecionar/KPI). [`245ed59`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/245ed59)
- [x] **4.x** — VT+VR agregados em uma linha "BENEFÍCIOS" por colaborador (UM PIX). Pagar marca os 2 IDs via bulk modal — DB mantém histórico contábil separado. [`7c7d6f9`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/7c7d6f9)
- [ ] **1.2** — fallback do 2FA: códigos de backup + reset por email *(plano técnico pendente — nova tabela + edge function)*
- [ ] **1.3** — reCAPTCHA *(deferido pelo Thales: só quando abrir portal pra clientes)*
- [ ] **3.0 + 4.0 (resto)** — auditoria funcional dos módulos Financeiro e Contas a Pagar (Thales pediu análise crítica antes de listar itens)
- [ ] **logo** — atual ainda não agrada o Thales (30/04 noite). Aguardando nova arte ou direcionamento.

---

### 🔴 Crítico — eu faço sozinho (sem mexer em banco / sem depender do Thales)
- [ ] **C42** — REMOVER feature saldo pré-pago (frontend + migration `DROP TABLE saldo_prepago, prepago_movimentacoes`). *Decisão: Thales nunca usou.*
- [ ] **C44** — REMOVER botão Gerar Verbas colaborador (frontend). *Decisão: Thales não usa.*
- [ ] **C45** — race condition no fallback boas-vindas. `useFinanceiro.ts:415-427`
- [ ] **C48** — validação de payload em `useContasPagar.create`. `useContasPagar.ts:82-83`

### 🔴 Crítico — eu escrevo, Thales aplica no Supabase
- [ ] **C43 Fase 2** — soft delete (`deleted_at` em processos/lancamentos) + tela de Lixeira com Restaurar
- [ ] **C43 Fase 3** — cron Supabase de 60 dias pra DELETE definitivo
- [ ] **C39** — mover `MASTER_USER` hardcoded do trello-guard pra env var
- [ ] **C28** — RLS `clientes_all` USING(true) cross-tenant
- [ ] **C29** — RLS `processos_all` USING(true)
- [ ] **C30** — RLS `lancamentos_all` USING(true)
- [ ] **C30b** — RLS `documentos`/`valores_adicionais`/`precos_tiers` USING(true)
- [ ] **C31** — RLS `cobrancas_authenticated_all` USING(true)
- [ ] **C32** — RLS `extratos`/`orcamentos` authenticated_all USING(true)
- [ ] **C33** — Storage bucket `documentos` sem filtro tenant
- [ ] **C34** — FKs sem ON DELETE (extratos, orcamentos, profiles, lancamentos)
- [ ] **C35** — `handle_new_user()` cria `empresa_id = gen_random_uuid()` (quebra multi-tenant)

### 🔴 Crítico — bloqueado por dependência externa
- [ ] **C40** — token Asaas em query string *(cross-repo: Apps Script Dani)*
- [ ] **C5/C12** — prompt injection Dani *(deferido pelo Thales 28/04)*
- [ ] **C7** — idempotência webhook Asaas em retries
- [ ] **C11** — atomicidade desconto boas-vindas *(provável: junto com C45)*
- [ ] **C13** — reconciliação Trello divergências
- [ ] **C14** — DRE impostos não-modulado
- [ ] **C15** — fluxo de caixa sem parcelamento

### 🔴 Crítico — agenda própria (decisão de produto)
- [ ] **C18** — telemetria de erros (Sentry/equivalente)
- [ ] **C22** — TS strict mode (~250 erros previsíveis, lote dedicado)
- [ ] **C24** — test coverage baseline

### 🟠 Importantes (42 itens — lotes recomendados)
- [ ] **Lote NaN frontend:** I001, I004, I005, I007
- [ ] **Lote Edge Functions:** I026 (retry backoff), I027/I028 (timeout), I029/I032 (PII em logs), I030 (rate limit create-user), I033 (service_role desnecessário)
- [ ] **Lote Banco:** I034/I035/I036 (CHECK em TEXT), I037 (NUMERIC 14,2), I038/I039 (migrations duplicadas)
- [ ] **I017** — validação URL de webhook (SSRF)
- [ ] **Resto:** I002, I003, I006, I008–I016, I018–I025, I031, I040–I042 (sem agrupamento óbvio)

### 🟡 Atenção (30 itens — dívida arquitetural)
- [ ] **A001–A013** — componentes/migrations/edge functions gigantes (refactor em helpers)
- [ ] **A014–A019** — magic numbers / strategy faltante
- [ ] **A020–A024** — UX/a11y (skeleton, aria-label, datas)
- [ ] **A025–A030** — banco / multi-tenant inconsistente

### 🟢 Quick wins / features (19 itens)
- [ ] **F009** — consolidar `fmt()` BRL helper (parar de redeclarar 8x)
- [ ] **F011** — `staleTime: Infinity` em queries imutáveis
- [ ] **F016** — índices compostos `(empresa_id, FK)`
- [ ] **F001** — dark mode toggle (CSS já suporta)
- [ ] **F002** — busca global Cmd+K
- [ ] **F003** — atalhos Esc/Ctrl+S
- [ ] **Resto:** F004–F008, F010, F012–F015, F017–F019

---

## 📐 Regra de trabalho (firmada 30/04 noite)

1. **Demandas do Thales têm prioridade** sobre o resto da auditoria.
2. **Antes de cada demanda nova**, eu consulto este checklist e te aviso se:
   - Tem algo da auditoria que **deve ser feito ANTES** (ex: um RLS aberto que afeta a tela que você quer mexer).
   - Tem algo da auditoria que **dá pra fazer junto** (ex: você pediu mudar a tela X e tem um item que vive na tela X).
3. **Ao fechar qualquer item** (demanda do Thales OU auditoria), atualizo este `.md` e abro o **Preview no chat** pra você bater olho.
