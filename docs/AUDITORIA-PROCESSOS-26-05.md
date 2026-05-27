# Auditoria Processos — 26/05/2026

> Disparada por Thales: auditoria abrangente do módulo Processos (kanban societário pós-DECISION-001 Fase 3, sync Trello, FK cascade, permissões, tipagem).
>
> Escopo real auditado: `src/pages/ProcessosAtivosDetalhe.tsx`, `src/pages/ReconciliacaoTrello.tsx`, `src/components/processos/*` (Modais MarcarPago/MarcarDeferido/ProcessoConfigEdit/PagamentoBadge), `src/hooks/useProcessos.ts`, `src/hooks/useProcessosFinanceiro.ts`, RPCs SQL de processo (DECISION-001 Fase 3, FEAT-001/002/003, FK cascade, created_by/updated_by, entidade_audit), `src/components/financeiro/ProcessoEditModal.tsx`, `src/components/clientes/TrelloProvisionButton.tsx`, integração Trello (provisionar-cliente-trello, trello-reconciliacao) e fluxos em `ClienteDetalhe.tsx`.
>
> **Importante (escopo Trello):** o repo NÃO tem `supabase/functions/trello-*` checadas in-tree (edges deployadas externamente). Auditei apenas o que o front consome: `provisionar-cliente-trello` e `trello-reconciliacao`. Páginas `trello-provisioner-logs` / `trello-guard-logs` existem no schema mas sem UI consumindo. **Não há sincronização processo→card Trello no código**: provisionador é por cliente (1 board / cliente), processos do ERP NÃO se vinculam a cards individuais. Isso é um achado por si só.
>
> **Importante (escopo Kanban):** a página `/processos` (kanban 18 colunas) foi removida em DECISION-001 Fase 3 (13/05). Hoje `/processos` redireciona pra `/processos-ativos` (drill-in detalhe) e `etapa` virou binária `'ativo' | 'finalizado'`. Múltiplas pontas do código ainda carregam débito do modelo antigo.

---

## 🔴 Bugs críticos

### PROC-001 — `DEFER_STAGES = ['registro', 'finalizados']` em ClienteDetalhe morto pós-Fase 3
**Arquivo:** `src/pages/ClienteDetalhe.tsx:1064-1065`
```ts
const DEFER_STAGES = ['registro', 'finalizados'];
const naoDeferidos = selectedProcs.filter(p => !DEFER_STAGES.includes(p.etapa));
```
Após `decision-001-fase3-enum-etapa.sql`, `processos.etapa` é CHECK CONSTRAINT que só aceita `'ativo' | 'finalizado'`. O UPDATE em massa converteu `registro → ativo` e `finalizados → finalizado`. **Resultado real:** para cliente `no_deferimento`, TODOS os processos selecionados caem como "não-deferidos" (porque nenhum tem `etapa='registro'` ou `'finalizados'` no banco hoje). O alerta de deferimento dispara sempre, mesmo quando processo já foi deferido. Funcionou só porque ao lado do AlertDialog tem a opção "Gerar Apenas Deferidos" (que usa `data_deferimento != null`, correto). Mas o filtro inicial está quebrado e mata UX.

**Fix:** trocar por `!isProcessoFinalizado(p.etapa) && !(p as any).data_deferimento` (consistente com linha 695 que já corrigiu isso pro `aguardandoDeferimento`).

### PROC-002 — `useDeleteProcesso` deixa `cobrancas.lancamento_ids[]` órfão / stale
**Arquivos:** `src/hooks/useProcessos.ts:47-108` + `docs/sql/fix-fk-cobrancas-lancamentos-cascade.sql`
A SQL de cascade observa explicitamente: "*A tabela cobrancas tem coluna lancamento_ids[] (array) que coexiste com a tabela junction. A junction parece ser a fonte de verdade pra FK. O array eh atualizado em paralelo pela aplicacao.*" Ao deletar processo, o CASCADE remove `lancamentos` e `cobrancas_lancamentos`, mas `cobrancas.lancamento_ids[]` mantém UUIDs zumbis apontando pra lançamentos deletados. Páginas tipo `OrcamentoNovo.tsx:159` e `Orcamentos.tsx:170` usam `.contains('lancamento_ids', [...])` — ficam com referência fantasma. Plus `cobrancas.total_geral` não é recalculado.

**Fix:** trigger AFTER DELETE em `lancamentos` que limpa do array `lancamento_ids` de toda `cobranca` que continha o id (`array_remove`), e marca `cobranca` como cancelada/total=0 se ficou sem nenhum lançamento.

### PROC-003 — Permissões de mutação não checadas no client (RPC garante tenant, NÃO action)
**Arquivos:** `src/components/processos/MarcarPagoProcessoModal.tsx`, `MarcarDeferidoProcessoModal.tsx`, `ProcessoConfigEditModal.tsx`
Modais NÃO chamam `usePermissions()`. Operacional/visualizador conseguem abrir e disparar `marcar_processo_pago` / `marcar_deferimento` / update direto na tabela `processos`. As RPCs validam `empresa_id` (tenant) mas não `pode_editar` / role. RLS de `processos` UPDATE também é permissiva por tenant (foi solta na decisão de política RLS de 18/05 — ver `project_rls_delete_design.md`). Resultado: secretária consegue marcar processo como pago / mexer em data de entrada sem ter `modulo='financeiro'` nem `pode_editar` em processos. Inconsistente com `ProcessoEditModal.tsx` (financeiro) que exige `PasswordConfirmDialog` para alterar valor.

**Fix:** RPCs deveriam validar `get_user_role()` e/ou `user_permissions.pode_editar` antes de mutar; modais deveriam esconder botões pra visualizador.

### PROC-004 — `ProcessoConfigEditModal` `created_at` UPDATE corrompe timezone
**Arquivo:** `src/components/processos/ProcessoConfigEditModal.tsx:77-79`
```ts
const horaOriginal = processo.created_at?.split('T')[1] || '00:00:00';
const novoCreatedAt = new Date(`${dataEntrada}T${horaOriginal.split('+')[0].split('Z')[0]}Z`).toISOString();
```
Pega "hora original" do timestamp do banco, mas força um `Z` (UTC) no final. Se `processo.created_at` veio do banco em `-03:00` (Brasília) ou Postgres devolve com offset, isso reseta pra UTC zerado. Pior: trigger `tg_set_processo_updated_meta` (18/05 SQL) sobrescreve `updated_at` qualquer um que vier no UPDATE, então o `updates.updated_at` é desnecessário, e pior — ao mudar `created_at` o trigger `tg_audit_processo_changes` NÃO monitora `created_at` (lista de campos em `historico-entidade-audit.sql:69` não inclui), logo essa mudança fica sem rastreabilidade no histórico (silenciosamente edita data de entrada de processo).

**Fix:** parsear `created_at` com `Date(processo.created_at)` direto, montar a nova data preservando ISO; ou padronizar pra UTC meio-dia (`T12:00:00Z`) como `cadastro-rapido` faz; ou usar coluna dedicada `data_entrada DATE` separada de `created_at`. E adicionar `created_at` ao array monitorado em `tg_audit_processo_changes`.

### PROC-005 — `ProcessoConfigEditModal` sem permissões + sem senha
**Arquivo:** `src/components/processos/ProcessoConfigEditModal.tsx`
Permite editar **razão social, tipo, prioridade, data de entrada, responsável, notas** sem `PasswordConfirmDialog` (financeiro tem; config não). Operacional/visualizador conseguem reescrever campos críticos. Combinado com PROC-003, isso é exfiltração leve de capabilities.

**Fix:** AlertDialog que existe pra `data_entrada` virar `PasswordConfirmDialog`; gate por `isMaster() || isGerente() || podeEditar('processos')`.

### PROC-006 — Processo sem cliente, sem cobrança, sem lançamento — estados zumbi não cobertos pela view
**Arquivo:** `decision-001-fase3-enum-etapa.sql` (view `processos_zombies`)
A view `processos_zombies` (MON-001) só pega processo `etapa='finalizado'` sem lançamento. NÃO pega:
- Processo `etapa='ativo'` com `is_archived=true` (arquivado mas sigiloso, não aparece em listas) sem lançamento.
- Processo com `cliente_id` apontando pra cliente já arquivado (não há FK CASCADE de arquivamento, e a página `ProcessosAtivosDetalhe` faz `not('etapa', 'in', ETAPAS_FINALIZADAS)` sem filtrar `cliente.is_archived`).
- Processo `data_deferimento != null` (deferido) mas lançamento `aguardando_deferimento` (drift entre RPC e UI direta).

`useProcessosFinanceiro` filtra `!p.is_archived` (linha 64) — bom — mas `useProcessosDB` e `useDashboardStats` NÃO filtram is_archived. Card count nos dashboards mostra processos arquivados.

**Fix:** estender view `processos_zombies` pra cobrir esses 3 casos + filtrar `is_archived` em todos os queries de listagem.

### PROC-007 — Reconciliação Trello é manual, opt-in, sem alerta de drift
**Arquivo:** `src/pages/ReconciliacaoTrello.tsx`
Página acessível só por URL direta (`/reconciliacao-trello`), só master. Faz match por código de 6 dígitos no nome do board (extrair `\b\d{6}\b`) e fallback por normalização de nome. **Sem persistência**: cada reload chama o edge novamente. Não há cron de reconciliação automática, sem alerta no Dashboard quando `boards no Trello > clientes no ERP` (FALTA NO ERP). Trello-guard-logs e trello-provisioner-logs existem mas SEM UI consumindo. Mestre só vê drift se entrar manualmente em `/reconciliacao-trello`. Em viagem do Thales (cenário documentado), Letícia/secretária não veem drift nenhum.

**Match por nome com `boardNorm.includes(nomeNorm) || nomeNorm.includes(boardNorm)`** é frágil — "ACME LTDA" e "ACME CONSULTORIA LTDA" colidem (cliente errado matched). Sem desempate.

**Fix:** badge "drift Trello: N" no Dashboard pra master; cron diário; persistir snapshot pra histórico; match restrito a códigos (drop o fallback por nome, ou exigir > 80% similaridade).

### PROC-008 — Provisionamento sem `processos.trello_card_id` — sync 1-via apenas
**Arquivos:** `src/integrations/supabase/types.ts:2384` (`trello_provisioner_logs.card_id`), `clientes.trello_board_id`
O schema tem `clientes.trello_board_id/url` mas **NÃO há coluna em `processos` linkando ao card Trello individual**. Conseqüência:
- Processo criado no ERP → não cria card Trello (provisioner roda no client board create, não em INSERT de processo).
- Card movido pra "Concluído" no Trello → ERP não atualiza `etapa='finalizado'`.
- Processo deferido no ERP → board Trello não recebe label/lista de "Deferido".

O comentário do projeto (`project_estado_18_05.md`) menciona "label-lembrete" e "reconciliacao" como funções Trello, mas o código atual só tem o ID do BOARD ligado ao cliente — não há sync processo↔card. Drift é estrutural, não bug pontual.

**Fix:** decisão de produto — ou linkar `processos.trello_card_id` + edge syncing nos dois sentidos (caro), OU documentar como "Trello é só visão complementar manual" (barato).

---

## 🟡 Melhorias

### PROC-009 — Duas `ProcessoDB` divergentes
- `src/types/financial.ts:10-27` → `etapa: string`, sem `created_by/updated_by/is_archived/data_deferimento/etiquetas/via_analise`.
- `src/hooks/useProcessos.ts:6-26` → `etapa: KanbanStage` (tipo restrito), sem `created_by/updated_by/is_archived/data_deferimento/etiquetas/via_analise`.

`src/integrations/supabase/types.ts:2111` (autogerado) inclui: `data_deferimento`, `is_archived`, `etiquetas`, `via_analise`, mas NÃO inclui `created_by`/`updated_by` (SQL aplicado em 18/05 mas types não regerados). Caso clássico de stale types.ts. Páginas usam `(p as any).created_by`, `(p as any).data_deferimento`, `(p as any).is_archived` — drift mascarado por `as any`.

**Fix:** rerun `supabase gen types typescript`. Unificar `ProcessoDB` num único lugar (`@/types/financial`) com TODAS as colunas. Re-importar em `useProcessos.ts`.

### PROC-010 — `useDashboardStats` faz 13+ queries em série, sem `staleTime`, sem N+1 guard
**Arquivo:** `src/hooks/useProcessos.ts:124-299`
Função monolítica: 13 queries Supabase em série (cliente, processos, lançamentos, valores_adicionais, etc), construindo agregações no JS. Sem `staleTime` (default = 0 → revalida em cada mount). Sem paginação. Para tenant com >1k processos, isso vai engasgar. Vários `.select('*')` sem projetar campos. `lancamentos.select('valor')` pega só valor, ok — mas `processos.select('*, cliente:clientes(*)')` pega o mundo, duas vezes.

**Fix:** mover agregações pra RPC no Postgres (`dashboard_stats` JSONB); adicionar `staleTime: 60000`. Promover `cliente:clientes(nome, apelido, valor_base, momento_faturamento)` em vez de `(*)`.

### PROC-011 — `useProcessosFinanceiro` realtime sem cleanup / debounce
**Arquivo:** `src/hooks/useProcessosFinanceiro.ts:17-36`
Subscreve realtime em 3 tabelas (processos, lancamentos, valores_adicionais), invalidando query a cada evento. **Sem debounce**: se um cron promove 50 lançamentos em batch, dispara 50 invalidations rapidamente, React Query refetcha 50x. Plus realtime canal não isola por tenant — backend filtra por RLS, ok, mas largura de banda gasta com noise.

**Fix:** debounce 500ms; ou usar `.filter()` no canal por `empresa_id`.

### PROC-012 — `ProcessoEditModal.handleSalvarComSenha` UPDATE não-atômico em duas tabelas
**Arquivo:** `src/components/financeiro/ProcessoEditModal.tsx:137-209`
Faz 2 UPDATEs separados: `processos` (com novo `valor` e `notas`), depois `lancamentos` (com `valor`, `valor_original`, `valor_alterado_em/por`). Se o segundo falhar, processo fica com valor novo e lançamento com valor antigo (drift). Errro de lançamento é só `console.warn` — usuário vê "Alterações salvas com sucesso" mesmo sem ter atualizado o lançamento.

**Fix:** RPC `editar_processo_valor(p_processo_id, p_novo_valor, p_observacoes)` atômica; ou pelo menos throw no segundo erro em vez de warn.

### PROC-013 — `useDeleteProcesso` checa documentos / valores_adicionais antes de deletar mas mensagens vagas
**Arquivo:** `src/hooks/useProcessos.ts:60-88`
Bloqueia delete se há `documentos` ou `valores_adicionais` ligados (FK RESTRICT). Mensagem boa, mas não diz **como remover** (qual tela, qual modal). Usuário trava sem caminho explícito. Plus: a checagem é em 2 round-trips antes do delete — race condition (alguém pode adicionar documento entre as 2 queries e o delete). Não crítico mas feio.

**Fix:** mensagem com link "Vá em Cliente / Processos / Editar / Valores Adicionais"; ou aceitar cascade RESTRICT + tratar o erro de PostgreSQL com mensagem traduzida.

### PROC-014 — `ProcessosAtivosDetalhe` mostra só 6 recentes + N urgentes, sem paginação / filtro
**Arquivo:** `src/pages/ProcessosAtivosDetalhe.tsx`
Header diz "Processos Ativos / detalhamento de processos em andamento" mas só renderiza 6 mais recentes + os urgentes (sem limit explícito; pega TODOS os urgentes do tenant). Sem filtro por cliente, tipo, responsável; sem busca; sem ordenação além de `created_at desc`. Para tenant com 30+ urgentes, lista cresce sem fim. ProcessosParados (Dashboard) navega pra essa tela ao clicar — usuário espera ver "processos parados", mas tela mostra urgentes e recentes.

**Fix:** paginação 20/página; filtro por dias parado / responsável / cliente; rota com query params `?status=urgente|parado|recente`.

### PROC-015 — `MarcarPagoProcessoModal` doc-comment stale
**Arquivo:** `src/components/processos/MarcarPagoProcessoModal.tsx:24`
Comentário: "*processo é promovido a etapa='finalizados'*". Após DECISION-001 Fase 3, etapa correta é `'finalizado'` (singular). Não bug funcional (RPC tá certa), mas confunde quem lê.

**Fix:** atualizar comentário (`finalizados` → `finalizado`).

### PROC-016 — `useUpdateLancamentoFinanceiro` insert sem `descricao` real / valor padrão hardcoded
**Arquivo:** `src/hooks/useProcessosFinanceiro.ts:125-138`
Quando lançamento não existe, INSERT com `descricao: 'Lançamento automático'` + `data_vencimento` = hoje+4d. Ignora `calcular_vencimento(cliente_id)` (RPC) que respeitaria `dia_vencimento_mensal` do cliente. Resultado: vencimento errado pra mensalistas com vencimento fixo. Também não respeita `momento_faturamento='no_deferimento'` (deveria virar `aguardando_deferimento`, vence `2099-12-31`).

**Fix:** mesma lógica da RPC `criar_processo_com_lancamento` (vencimento + etapa por `momento_faturamento`).

### PROC-017 — `criar_processo_com_lancamento` RPC tem `EXECUTE format(... %L)` pra via_analise (SQL injection morto, mas estranho)
**Arquivo:** `docs/sql/decision-001-fase3-enum-etapa.sql:179-184`
```sql
IF p_via_analise IS NOT NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'processos' AND column_name = 'via_analise'
) THEN
  EXECUTE format('UPDATE public.processos SET via_analise = %L WHERE id = %L', p_via_analise, v_processo_id);
END IF;
```
Pattern defensivo "se a coluna existir, atualiza" sobrou da migração (coluna existe agora — confirmado em `types.ts:2134`). `%L` é safe (literal escape), mas o pattern dinâmico não tem mais razão de ser. Mais grave: enum `via_analise` é `'matriz'|'regional'|'metodo_trevo'` mas a RPC aceita TEXT livre — se vier valor inválido, levanta exception genérica do enum, não rejeita com mensagem útil.

**Fix:** virar `INSERT ... via_analise` direto na linha 166 (sem `EXECUTE format`), e validar `p_via_analise IN ('matriz','regional','metodo_trevo')` no início.

### PROC-018 — `valores_adicionais` sem `is_taxa_reembolsavel`/`reembolsavel` lock
Lendo `valores_adicionais.reembolsavel: boolean` — pode mudar a qualquer momento depois que cobrança foi gerada/extrato emitido. Sem trigger que congele o flag após extrato. Operador pode mudar de "reembolsável" pra "não reembolsável" depois de cliente receber cobrança — drift contábil silente.

**Fix:** trigger BEFORE UPDATE bloqueando alteração de `reembolsavel` se `EXISTS (cobranca usando esse lancamento)`.

### PROC-019 — `trello_guard_logs` schema existe mas zero UI / cron de revisão
**Arquivo:** `src/integrations/supabase/types.ts:2380-2421`
Tabela com `action_type, board_id, member_username, was_reverted, revert_detail`. Implica edge externa que reverte ações suspeitas no Trello. Master nunca vê esses logs (sem UI). Se membro mal-intencionado tenta apagar coluna do board e a edge reverte, o evento fica enterrado.

**Fix:** painel admin `/trello-logs` com filtro por dia / cliente / action_type; ou pelo menos email diário pro master quando `was_reverted=true`.

### PROC-020 — `notas` campo abusado pra metadata (Valor Manual, Boas-vindas, etc)
**Arquivo:** `src/lib/observacao-processo.ts` + escritores em `useFinanceiro.ts` + `ProcessoEditModal.tsx:154-159`
`processos.notas` recebe **observação do operador** misturada com **flags auto-geradas** (regex em `observacao-processo.ts` filtra na hora de exibir ao cliente). Pattern frágil — qualquer texto novo que o operador digite parecido a "Boas-vindas 10%" vai ser filtrado por engano. Plus: trigger de histórico monitora `notas` (em `historico-entidade-audit.sql:69`) — gera entrada de audit toda vez que sistema appenda metadata, criando barulho enorme.

**Fix:** mover flags pra colunas dedicadas (`processo.flag_boas_vindas`, `processo.flag_valor_manual`, etc, ou JSONB `processo.meta_flags`). `notas` vira só texto livre humano.

---

## 🟢 OK / Polish

### PROC-021 — `mock-data.ts` dead code com TS2322 latente
**Arquivo:** `src/data/mock-data.ts:4-21`
Cada linha declara `stage: 'recebidos'/'analise_documental'/'contrato'/...` que viola `KanbanStage = 'ativo' | 'finalizado'`. **Não está importado em lugar nenhum** (confirmado `grep -rn "import.*mock-data" src/` = 0 hits). Mas existe no repo, TypeScript pode reclamar em build se `noEmitOnError`. Quando alguém reativar pra testes, fica caos.

**Fix:** deletar `src/data/mock-data.ts`.

### PROC-022 — `PROCESS_TYPE_LABELS` duplicado em 2 lugares
`src/types/process.ts:47` E `src/types/financial.ts:99` definem o mesmo mapa. Mudar tipo de processo precisa atualizar nos 2.

**Fix:** consolidar em `@/types/financial` (mais usado).

### PROC-023 — `KanbanStage` exportado mas único consumidor é `useProcessos.ts`
Após DECISION-001, `KanbanStage` + `KANBAN_STAGES` só sobrevivem por retrocompat de tipo. Variáveis com nome "Kanban" confundem leitor (não existe mais kanban). Boa hora pra renomear `EtapaProcesso` e arquivar o nome antigo.

**Fix:** renomear `KanbanStage → EtapaProcesso`, `KANBAN_STAGES → ETAPAS_PROCESSO`; arquivar interface `Process` de `process.ts` (não usado).

### PROC-024 — `ProcessosAtivosDetalhe` skeleton só na inicial (sem refresh visual)
Tela carrega `useDashboardStats` (queryKey `dashboard_stats`). Compartilhado com Dashboard — invalidação em qualquer mutation triggers refetch (já vi `qc.invalidateQueries({ queryKey: ['dashboard_stats'] })` em `useDeleteProcesso`). Sem indicador de "atualizando…" — usuário pode achar que tela quebrou se ficar 2-3s sem mudança.

**Fix:** `isFetching` ao lado do título.

### PROC-025 — `ReconciliacaoTrello` carregar 3 promises em `Promise.all` — sem retry / timeout
**Arquivo:** `src/pages/ReconciliacaoTrello.tsx:79-83`
Se edge `trello-reconciliacao` demora (Trello API lenta), página fica spinner infinito. Sem timeout, sem botão "Cancelar".

**Fix:** `AbortController` com 30s; toast informativo.

### PROC-026 — `PagamentoBadge.classificarPagamento` não considera `data_pagamento` futura
**Arquivo:** `src/components/processos/PagamentoBadge.tsx:9-21`
Status `pago` é só `lanc.status === 'pago'`. Não tem fallback pra `confirmado_recebimento=true && data_pagamento != null`. Inconsistente com `marcar_processo_pago` RPC que seta os 3 campos.

**Fix:** ok hoje (RPC garante consistência), mas se manualmente um operador setar `data_pagamento` sem `status='pago'`, badge mostra vencido. Documentar invariante.

### PROC-027 — `UltimosProcessos` (cadastro rápido) ignora `is_archived`
**Arquivo:** `src/components/cadastro-rapido/UltimosProcessos.tsx:18-27`
Pega 5 processos mais recentes de um cliente, ordenando por `created_at`. Não filtra `is_archived`. Se últimos 5 são arquivados, lista vem com cards de processos que não existem mais no fluxo ativo.

**Fix:** adicionar `.eq('is_archived', false)`.

### PROC-028 — `desfazer_marcar_pago` RPC guard em `cobranca_enviada` é razoável mas mensagem só em PT-BR
**Arquivo:** `docs/sql/decision-001-fase3-enum-etapa.sql:510-517`
Hardcoded `RAISE EXCEPTION 'Cobrança já foi enviada ao cliente...'`. Sem i18n. Ok pro escopo Trevo (BR only), mas se um dia for SaaS, vira refactor.

### PROC-029 — `ETAPAS_FINALIZADAS_SQL_IN` exposed como string literal pronto pra filtros
**Arquivo:** `src/types/process.ts:28`
`'("finalizado","finalizados","arquivo","concluido")'` — funciona, mas é coragem do desenvolvedor passar string literal pra `.not('etapa', 'in', X)`. Se algum dia a Supabase JS lib mudar parsing, quebra silenciosamente. Plus: depende de etapas legadas ainda existirem (após CHECK CONSTRAINT, só 'ativo'/'finalizado' são possíveis — então `'finalizados'/'arquivo'/'concluido'` é defensive code que nunca matcha mais).

**Fix:** simplificar pra `.eq('etapa', 'ativo')` agora que CHECK garante o domínio.

---

## 📊 Resumo

| Categoria | Quantidade |
|---|---|
| 🔴 Críticos | 8 (PROC-001 a PROC-008) |
| 🟡 Médios | 12 (PROC-009 a PROC-020) |
| 🟢 Polish/OK | 9 (PROC-021 a PROC-029) |
| **Total** | **29 achados** |

### Top 5 ações sugeridas (ROI / risco)

1. **PROC-001** (1 linha) — corrigir `DEFER_STAGES` em ClienteDetalhe; UX de cliente `no_deferimento` está quebrada hoje.
2. **PROC-003 + PROC-005** (SQL + 3 modais) — adicionar guard `pode_editar` em RPCs `marcar_processo_pago/deferimento` e em modais; secretária consegue marcar pago sem permissão financeira.
3. **PROC-002** (1 trigger) — limpar `cobrancas.lancamento_ids[]` ao deletar lançamento; previne fantasmas.
4. **PROC-009** (1 comando) — regerar `types.ts` (`supabase gen types`) e unificar `ProcessoDB`; resolve drift de tipos sem `as any` por todo lado.
5. **PROC-007 + PROC-008** (decisão de produto) — definir se Trello é fonte/espelho/visão; ou implementar sync processo↔card, ou documentar limites e parar de chamar de "sincronização".

### Estado da integração Trevo ↔ Trello (foco do pedido)

- **Provisionamento:** funcional (1 board / cliente via `provisionar-cliente-trello`). Botão visível em `ClienteDetalhe`.
- **Sync processo→card / card→processo:** **NÃO EXISTE no código auditado**. Schema sem `processos.trello_card_id`. Trello opera como board visual paralelo, não sincronizado.
- **Reconciliação:** **manual, opt-in, sem alerta de drift**. Página `/reconciliacao-trello` faz match por código no nome do board (heurística), só master, sem persistência, sem cron.
- **Guard / Label-lembrete edges:** menciono porque `trello_guard_logs` e `trello_provisioner_logs` existem no schema — implicam edges deployadas externamente (não auditáveis aqui). Sem UI consumindo. Provavelmente cron Trello-side, drift invisível pro time.
- **Webhooks Trello → ERP:** **não encontrei evidência no código**. Edge `provisionar-cliente-trello` é call-by-front, não webhook listener.

**Veredicto integridade Trevo↔Trello:** baixa. Não há reconciliação automática, não há sync de estado, e a página manual de reconciliação tem heurística frágil (fallback nome-includes). Em viagem (cenário 19/05 documentado), Letícia/secretária não têm como detectar drift sem entrar manualmente em `/reconciliacao-trello`. Sugiro tratar Trello hoje como "visão complementar do cliente" e não como "fonte sincronizada" — ou investir num link processo↔card de verdade.
