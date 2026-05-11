# 🔥 AUDITORIA GROTESCA — TREVO ERP

> **Doc vivo.** Atualizado a cada commit. Última atualização: **11/05/2026 noite** — auditoria de fluxo completa pré-release Letícia/secretária + 6 fixes adicionais (SEC-014, SEC-015, PERM-005, UX-028, UX-029, UX-100).
> Auditoria original disparada pelo Thales: *"AUDITORIA COMPLETAMENTE GROSTESCA NESSE ERP! MAS GROTESCA MESMO OK?"*

---

## 📚 Auditoria de fluxo completa — 11/05/2026 noite

Disparada por: Thales pediu auditoria de DESIGN/UX (não de código), véspera do release pra Letícia + secretária.

Resultado detalhado em **[`docs/auditoria-fluxo-completa/`](./docs/auditoria-fluxo-completa/)**:
- **17 telas auditadas** + **5 anexos transversais** (permissões, banco, edge functions, code review, personas)
- **~120 achados** novos com IDs (UX-028 a UX-123, REL-013 a REL-021, SEC-009 a SEC-018, PERM-001 a PERM-010, INT-001, SUG-DATA-001 a 003, SUG-NAV-1 a 7, SUG-PERM-008 a 010)
- **Veredito GO/NO-GO** por tela
- **6 fixes aplicados em produção** após auditoria (commits abaixo)

### 🔴 Bloqueadores pré-release atacados nesta sessão

| ID | Status | Resumo | Commit |
|---|---|---|---|
| **SEC-015** | ✅ FIXADO | Master podia se auto-desativar via Gestão de Usuários (1-clique self-DoS) | `disabled={isMe}` nos botões Desativar/Remover |
| **SEC-014** | ✅ FIXADO | Label "Remover" enganava — função só desativa, não deleta | Renomeado pra "Desativar permanente" + tooltip explicativo |
| **PERM-005** | ✅ FIXADO | `/reconciliacao-trello` sem `RequirePermission` — qualquer authenticated acessava | Adicionado `<RequirePermission modulo="configuracoes">` |
| **UX-028** | ✅ FIXADO | Logo Trevo no sidebar não navegava pra Dashboard | Envolvido com `<Link to="/">` |
| **UX-029** | ✅ FIXADO | `roleLabel` não mapeava 'gerente' — Letícia ia ver string vazia | Mapeamento completo |
| **UX-100** | ✅ FIXADO | Drag de processo pra `registro`/`finalizados` disparava cobrança sem aviso | `confirm()` pré-drop só pra cliente `no_deferimento` |

### 🟡 Achados críticos mapeados (não atacados, em backlog)

| ID | Severidade | Descrição |
|---|---|---|
| **INT-001** | 🔴 | Orçamento "Convertido" é só rótulo — não cria processo/lancamento/cobrança (Thales reclamou explicitamente). Detalhes em `12-orcamentos.md`. |
| **PERM-008** | 🔴 (futuro) | RLS de `cartoes`, `cartao_compras`, `cartao_faturas` permissivo (`qual='true'`). OK hoje (1 empresa), dívida multi-tenant. |
| **PERM-009** | 🟡 (futuro) | RLS de `contatos_estado`, `notas_estado`, `precos_tiers` permissivo |
| **PERM-004** | 🔴 | `usePermissions` falha silenciosa sem profile → estado fantasma |
| **REL-014** | 🔴 | `executarGeracaoExtrato` 5 awaits sequenciais sem rollback |
| **UX-013** | 🔴 | `DeferimentoModal` for-loop sem rollback (lote parcial) |
| **UX-015** | 🔴 | Bulk "Marcar Pagos" sem confirm/data |
| **UX-019** | 🔴 | "Ativar Método Trevo" 4 awaits sem rollback |
| **FEAT-004** | 🔴 | 3 caminhos diferentes de "marcar pago" (consolidar via RPC) |
| **REL-017** | 🔴 | Race condition no register (1s wait pra trigger DB) |
| **REL-019** | 🔴 | `/reset-password` não existe — link de reset cai em 404 |
| **DECISION-001** | 🔴 | Kanban operacional (já mapeado anteriormente — 4 fases roadmap) |

Demais 100+ achados são UX/polish — ver docs individuais.

### 📝 SQL pendente nessa sessão (opcional, não bloqueia release)

Nenhum. Todos os 6 fixes foram puramente código.

---

## 🟢 Sessão 11/05/2026 — bug zumbi SEPI/ASLAN + cleanup

Disparado por: Thales reportou processo SEPI cadastrado pra ASLAN não aparecia no Financeiro. Investigação via MCP Supabase (read-only) descobriu cadeia maior.

| ID | Status | Achado | Fix | Commit |
|---|---|---|---|---|
| **DATA-005** | ✅ FIXADO (manual SQL) | Processo SEPI (id `201233c9-...`) zumbi: etapa `concluido` sem lançamento. Único caso em todo o banco (n=1). | INSERT do lançamento via SQL editor — R$ 870, pago 12/02/2026, etapa `honorario_pago`, `confirmado_recebimento=true`. | _este commit_ |
| **REL-009** | ✅ FIXADO | `useMoveEtapaFinanceiro` (linhas 87-146 de `useProcessosFinanceiro.ts`) era código morto (zero imports/chamadas) e era o **único caminho do front** que escrevia `etapa='concluido'` em `processos`. Bug latente: INSERT do lancamento + UPDATE da etapa não eram atômicos. | Removido o hook inteiro. Comentário no lugar explica o porquê pra histórico. | _este commit_ |
| **UX-007** | ✅ FIXADO | Scroll do sino de notificações travado. `<ScrollArea className="max-h-[420px]">` não funciona com Radix porque o Viewport interno usa `h-full` — sem altura concreta no Root, overflow não calcula. | Trocado por `h-[420px]` em `NotificationPopover.tsx:159`. | _este commit_ |
| **MON-001** | ✅ FIXADO (SQL manual) | Não havia sentinela detectando processos zumbis. | View `public.processos_zombies` lista processos em etapa terminal sem lançamento. Idealmente sempre vazia. SQL no fim deste doc. | _este commit_ |
| **UX-008** | ⏸️ DEFERIDO | Notificações de pagamento/cobrança caem em `/financeiro` genérico (sem filtrar pelo lançamento específico) porque tabela `notificacoes` só tem FK `orcamento_id` — não tem `processo_id`/`lancamento_id`. | Migration: `ALTER TABLE notificacoes ADD COLUMN processo_id uuid REFERENCES processos(id), ADD COLUMN lancamento_id uuid REFERENCES lancamentos(id)` + atualizar publishers e roteamento em `NotificationPopover.handleClick`. Thales escolheu fazer junto, mas precisa migration — vai ficar pra próxima sessão dedicada. | — |
| **FEAT-001** | ✅ ENTREGUE (SQL manual) | Antes só era possível marcar processo como pago **no momento do cadastro** (checkbox "Já pago"). Cadastros retroativos ficavam pendentes no Financeiro. | Botão verde ✓ na coluna Ações de cada processo em `ClienteDetalhe.tsx` (só aparece se o processo não está pago). Abre modal pedindo a data de pagamento (default: hoje, aceita retroativa). Backend: RPC `marcar_processo_pago` (SQL no fim deste doc) — atômica, tenant check, espelha o comportamento de `ja_pago=true` (lançamento → pago/honorario_pago/confirmado, processo → finalizados). | _este commit_ |
| **DATA-006** | ✅ FIXADO (SQL manual) | Constraint `lancamentos_valor_positivo_check` (`valor > 0`) bloqueava UPDATE em lançamentos legados com valor 0 (processos de cortesia, ex: CSP PARTICIPAÇÕES). Constraint estava `NOT VALID` (não revalidou histórico), mas trava qualquer UPDATE nessas linhas. 8 lançamentos com valor 0 no banco (5 já pagos — caso normal de cortesia/franquia). | Trocada por `lancamentos_valor_nao_negativo_check` (`valor >= 0`). Mantém proteção contra negativos. Front não dependia dela (greps confirmam: só lógicas de UI condicional, nenhuma invariante). | _este commit_ |
| **REL-012** | ✅ FIXADO | Aba "Pagos no período" em `/financeiro → Historico` filtrava por `data_vencimento` em vez de `data_pagamento`. Resultado: pagamento atrasado (cliente paga em Maio um boleto que venceu em Abril — caso comum) sumia do mês em que foi efetivamente recebido. Cliente FATO: cobrança paga em 11/05 com 3 lançamentos (2 venc Abril + 1 venc Maio) só mostrava 1 dos 3 em "este_mes". | `useFinanceiroClientes.ts:225-226` — trocado `data_vencimento` por `data_pagamento` no filtro de período pros pagos. Pendentes seguem sem filtro de período (lógica anterior preservada). | _este commit_ |
| **DATA-007** | ✅ FIXADO (SQL manual) | Processo RCB AGROPECUARIA antigo (lanc `9399d050…`, processo `080872dc…`) da FATO foi marcado deferido por engano em 06/05. Como o cliente é `no_deferimento`, lançamento subiu pra `solicitacao_criada` com vencimento real, e processo ganhou `data_deferimento`. Caso pontual confirmado pelo Thales. | Reverter: `processos.data_deferimento=NULL` + `lancamentos.etapa_financeiro='aguardando_deferimento'` + `lancamentos.data_vencimento='2099-12-31'`. Etapa operacional do processo (`registro`) preservada — independente do financeiro. SQL no fim deste doc. | _este commit_ |

### 🟢 Batch UX entregue nessa sessão (após auditoria de contadores)

Auditoria de **fluxo & premissas** disparou batch pós-auditoria. Thales: "trabalha de forma reativa, eu não quero isso; faz auditoria de design, não só de código."

| ID | Status | Descrição | Fix |
|---|---|---|---|
| **UX-010** | ✅ FIXADO | Cadastrar processo (ou qualquer mutação) em `ClienteDetalhe.tsx` jogava você de volta pra aba "Financeiro". `loadAll(id)` → `setLoading(true)` → `<Skeleton/>` early return → Tabs com `defaultValue` remontava → volta pra aba default. Achado em <2min de auditoria de fluxo. | `<Tabs>` controlado via `useState`. `loadAll` aceita `{ silent: true }` pra refresh pós-mutação não disparar skeleton. 12 chamadas convertidas pra silent. | _este commit_ |
| **UX-009** | ✅ FIXADO | "Devolver pra auditoria" agia em **todos** os processos do cliente. Sem seleção. | Reaproveita checkbox de seleção que já existia. `selected.size > 0` → devolve só selecionados. `=0` → fallback no comportamento legado (todos). Botão mostra contagem. | _este commit_ |
| **FEAT-002** | ✅ ENTREGUE (SQL manual) | Marcar deferido só existia em `/financeiro → Auditoria → DeferimentoModal`. Lugar errado mentalmente — usuário cadastra processo em `CLIENTES`, espera operar dali. | Botão Check verde na coluna Ações do processo em `ClienteDetalhe.tsx` — só aparece se cliente `no_deferimento` + lançamento `aguardando_deferimento`. RPC `marcar_deferimento` (atômica, tenant check). Coexiste com DeferimentoModal de lote. | _este commit_ |
| **FEAT-003** | ✅ ENTREGUE (SQL manual) | Não dava pra desfazer deferimento marcado por engano. | Botão Undo amarelo na mesma coluna — só aparece se processo tem `data_deferimento` mas lançamento ainda em `solicitacao_criada`/`cobranca_gerada`. RPC `desfazer_deferimento` (guard anti-rebaixamento `honorario_pago`/`cobranca_enviada`). | _este commit_ |
| **UX-008** | ⏸️ PROTELADO | Notificações cobrança/pagamento caem em `/financeiro` genérico. Resolver exige adicionar FK em `notificacoes` + atualizar edge function `asaas-webhook` + roteamento. **Bloqueador:** `asaas-webhook/index.txt` (em vez de `index.ts`) — função desabilitada de deploy. Precisa confirmação do Thales sobre por que. | (estado anterior preservado abaixo) |

### 🟢 Quick fixes pós-auditoria de fluxo (atacados nessa sessão)

Auditoria proativa de fluxo (não de código) — Thales pediu pra eu enxergar problemas que ele vivencia mas não tinha me reportado. Agent varreu 8 fluxos críticos e levantou 27 achados; depois de triagem manual destes 3 saíram já fixados, os outros viraram backlog.

| ID | Status | Descrição | Fix aplicado |
|---|---|---|---|
| **UX-011** | ✅ FIXADO | Botão "Gerar Cobrança" no `ClienteDetalhe` baixava um `.txt` local — não criava cobrança/Asaas/extrato. Label enganosa: usuário acha que cobra, na verdade só baixa arquivo. | Renomeado pra "Baixar resumo (.txt)" + ícone trocado de `Receipt` pra `FileText` + descrição honesta no dialog. Funcionalidade mantida (útil pra controle interno); só não engana mais. |
| **UX-020** | ✅ FIXADO | "Gerar Fatura Mensal" pra mensalista criava lançamento e **redirecionava pra `/financeiro`**, tirando o usuário do cliente em que estava operando. Bate com a queixa do Thales "tela me leva pra outro lugar". | Removido `navigate('/financeiro')`. Apenas toast + `loadAll(silent)`. |
| **REL-013** | ✅ FIXADO | Channel realtime de notificações em `NotificationPopover.tsx:71-89` subscrevia INSERTs **sem filter `empresa_id`**. RLS bloqueia SELECT, mas o payload do realtime passa direto pelo WebSocket — em multi-tenant, toast/sino disparava pra eventos de outras empresas. Hoje só tem 1 empresa ativa, mas é vulnerabilidade pronta pra estourar. | Channel passa a usar `filter: empresa_id=eq.{id}` + nome do canal por empresa (`notificacoes_realtime_${empresaId}`). Async init protegido por flag `cancelled` no cleanup. |

### 🟡 Backlog mapeado pela auditoria de fluxo (atacar depois)

24 achados restantes da auditoria de fluxo, triados.

| ID | Severidade | Local | Problema | Esboço fix |
|---|---|---|---|---|
| **FEAT-004** | 🔴 | `FinanceiroList.tsx:62-89` + `ContasReceberLista` + `MarcarPagoProcessoModal` | **3 caminhos diferentes** pra "marcar pago" com comportamentos divergentes: (a) modal com data retroativa via RPC `marcar_processo_pago` (atômico, com tenant check), (b) bulk em `ContasReceberLista` com `data=hoje` sem confirmação, (c) `handleDesfazerPagamento` faz UPDATE bruto sem tenant check. | Consolidar tudo na RPC `marcar_processo_pago`. Bulk deve pedir data via modal. |
| **REL-014** | 🔴 | `ClienteAccordionFinanceiro.tsx:610-766` | `executarGeracaoExtrato` faz 5 awaits sequenciais (upload PDF → insert extrato → update N lancamentos → insert cobranca). Se cobrança falhar (linha 738), `console.error` silencioso e `toast.success` mente — extrato existe sem cobrança. | RPC `gerar_extrato_completo` ou ao menos `toast.warning` quando cobrança falha. |
| **UX-013** | 🔴 | `DeferimentoModal.tsx:75-90` | `for`-loop com `await` sem rollback. Se 3º de 5 processos falha, 2 primeiros já têm `data_deferimento` salvo, mas toast mostra erro como se nada tivesse mudado. | `Promise.allSettled` + relatório por processo OR RPC bulk `marcar_deferimento_em_lote`. |
| **UX-014** | 🔴 | `ClienteDetalhe.tsx:2363-2407` | Dialog "Marcar como Faturado" pós-extrato lê `selectedProcessosTab.size` mas `gerarExtratoClienteDetalhe(procs)` aceita lista arbitrária. Se chamado com lista diferente, counts/ações dessincronizadas. | Passar `procsToGenerate` pro dialog em vez de ler state global. |
| **UX-015** | 🔴 | `ContasReceberLista.tsx:88-94` | `handleMarcarLote` marca todos como pagos com `data=hoje`, sem AlertDialog, sem confirmação. Master clica e N lançamentos viram pagos. Sem undo evidente. | Mesmo padrão do `MarcarPagoProcessoModal` — modal com data input e confirmação. |
| **UX-019** | 🔴 | `ClienteAccordionFinanceiro.tsx:515-631` | "Ativar/Desativar Método Trevo" faz 4 awaits encadeados (fetch etiquetas → update processo → update lancamento). Sem rollback. Toast "ativado" mas estado fica inconsistente se algum await falhar no meio. | RPC `ativar_metodo_trevo` / `desativar_metodo_trevo` atômicas. |
| **UX-008** | 🟡 | `NotificationPopover.handleClick` | (já mapeado) Notificações de pagamento/cobrança caem em `/financeiro` genérico. Bloqueador: `asaas-webhook/index.txt` (Thales: "deixa assim"). | Adicionar `cliente_id` em `notificacoes` (via migration), atualizar publishers OU resolver no front com lookup. Atacar quando webhook for revisitado. |
| **UX-012** | 🟡 | `ClientesAuditoria.tsx:427-451` | Excluir processo dispara cascade DELETE (`lancamentos` + `processos`) com AlertDialog simples. Em outras telas (arquivar cliente) exige `PasswordConfirmDialog`. Inconsistente. | Decisão de produto: pedir password ou ao menos digitar nome do processo. |
| **UX-016** | 🟡 | `ClienteDetalhe.tsx:1827-1857` | Alert de boas-vindas: clicar "Não, obrigado" (`AlertDialogCancel`) chama `setShowNovoProcesso(true)` — abre o modal mesmo. Tecnicamente correto (fluxo: pular boas-vindas e seguir), mas label ambígua. | Renomear pra "Pular desconto" ou similar. |
| **UX-017** | 🟡 | `CobrancaPublica.tsx:387` | `tipoPrincipal`/`empresaPrincipal` usam apenas `lancamentos[0]` no card da Dani. Em cobrança consolidada com 5 processos diferentes, mensagem vira "dúvida sobre abertura da X" ignorando os outros 4. | Usar `multiplosProcessos` (já checked no código) pra fallback genérico. |
| **UX-018** | 🟡 | `Dashboard.tsx:144 vs 463` | Alerta auditoria usa `navigate('/financeiro', { state: { tab: 'auditoria' } })`; outros usam `?tab=vencidos`. 2 convenções no mesmo componente. | Padronizar querystring (sobrevive refresh). |
| **REL-015** | 🟡 | `Dashboard.tsx:147-151` | "Clientes sem extrato" filtra só `etapa_financeiro === 'solicitacao_criada'`. Processos `aguardando_deferimento` somem do alerta. | Incluir `aguardando_deferimento` ou criar alerta próprio "Aguardando deferimento". |
| **UX-023** | 🟡 | `ClienteDetalhe` (cliente PRÉ-PAGO) | Recarga é feita sobrescrevendo `saldo_prepago` no form de edit cadastro. Tabela `prepago_movimentacoes` existe mas **não tem leitura no front**. Histórico de recargas/débitos invisível. | Botão "Recarregar saldo" com modal que insere em `prepago_movimentacoes` + lista de movimentações na ficha. |
| **UX-024** | 🟡 | `CobrancaPublica.tsx:114-127` | Dedup de confetti via `localStorage` (24h). Refresh em D+2 dispara confetti de novo — "celebração" recorrente desconfortável. | Marcador no banco (`cobrancas.confetti_visto_em`) ou timestamp permanente. |
| **UX-026** | 🟢 | `Dashboard.tsx:434-447` | "Tudo em dia!" aparece mesmo quando há alertas em módulos sem permissão. Usuário não-master vê verde com problemas reais escondidos. | Texto condicional ("Sem alertas no seu escopo"). |
| **UX-027** | 🟢 | `CobrancaPublica.tsx:466-484` | Tab "Boleto" some quando `temBoleto=false`. Se usuário tinha state="boleto" stuck, perde sem aviso. | Tab sempre visível com estado "Gerando..." quando indisponível. |

### 🔴 DECISION-001 — kanban operacional (análise consolidada)

Thales: *"meu sistema nao tem que ver em que etapa o processo está! Apenas saber se ele existe."* + *"PROCESSOS > KANBAN — pode tirar essa merda"*.

**Achado crítico via SQL:** banco já usa o kanban como **binário** na prática.

| Etapa | Processos | % |
|---|---|---|
| `recebidos` | 117 | 76% |
| `registro` | 23 | 15% |
| `finalizados` | 11 | 7% |
| `concluido` | 2 (zombies — DATA-005) | 1% |

**14 das 18 etapas do `KANBAN_STAGES` (analise_documental, contrato, viabilidade, dbe, vre, taxa_paga, assinaturas, assinado, em_analise, mat, inscricao_me, alvaras, conselho, arquivo) — ZERO processos.** UI inteira é teatro.

**Onde o kanban está enraizado:**
- `src/types/process.ts` — enum `KANBAN_STAGES` (18 valores) + `KanbanStage` type
- `src/pages/Processos.tsx` (710 linhas) — página inteira é kanban + lista, drag-and-drop
- `src/pages/Dashboard.tsx:215-221, 488-514` — pipeline + alertas baseados em etapa
- `src/components/financeiro/{ClientesAuditoria,FinanceiroList,ClienteAccordionFinanceiro}.tsx` — `ETAPAS_DEFERIDAS`, `ETAPAS_PRE_DEFERIMENTO`, coluna "Etapa"
- `src/pages/{Clientes,ClienteDetalhe}.tsx` — badges, contagens "processos ativos"
- `src/pages/Documentos.tsx:57` — seta `etapa='analise_documental'` (única etapa intermediária ainda escrita)
- `src/hooks/{useProcessos,useProcessosFinanceiro,useFinanceiroClientes}.ts` — leem etapa
- `src/lib/relatorio-*.ts` — relatórios PDF filtram por etapa
- RPCs: `criar_processo_com_lancamento` (seta `recebidos`/`finalizados`), `marcar_processo_pago` (seta `finalizados`)

**3 caminhos:**

| Caminho | Esforço | Risco | Resultado |
|---|---|---|---|
| **A) Reforma radical** | 8-12h | médio | `processo.etapa` vira binária (`ativo`/`finalizado`). Remove página `/processos`, drag-and-drop, badges de etapa, KANBAN_STAGES. Dashboard só mostra "ativos/finalizados". Migra dados (`'recebidos'`/`'registro'` → `'ativo'`; `'finalizados'`/`'concluido'` → `'finalizado'`). |
| **B) Esconder UI, manter schema** | 3-4h | baixo | Schema intacto. Remove rota `/processos` do menu (e redireciona pra `/clientes`). Esconde badges. Reversível. Dado "fantasma" sobra no banco. |
| **C) Não fazer nada** | 0h | nenhum | Thales ignora a aba `/processos`. UI continua enganosa pra outros operadores futuros. |

**Recomendação: A em 4 fases.**

1. **Fase 1 (esta sessão):** documentar decisão + roadmap. ✅
2. **Fase 2 (1 sessão, 3h):** esconder UI — remove rota `/processos` do menu, remove badges de etapa em `ClienteDetalhe`/`Clientes`/`Dashboard`, mantém schema. Reversível. Entrega valor imediato.
3. **Fase 3 (1 sessão, 4h):** simplificar enum — migration `etapa` text só aceita `'ativo'`/`'finalizado'`; UPDATE em massa pra normalizar; RPCs atualizadas; remover `KANBAN_STAGES` do TS.
4. **Fase 4 (1 sessão, 2h):** limpeza — remove arquivo `Processos.tsx` inteiro, remove dependência `@hello-pangea/dnd` (drag-and-drop) se só era usada lá, remove relatórios filtrados por etapa.

**Próximo passo:** Thales aprova roadmap A na próxima sessão dedicada. Não atacar fora dessa sessão (refactor com tela própria).

**Insights:**
- O zombie SEPI **não foi causado pelo código atual** — os 3 únicos lugares que escrevem `etapa='concluido'` no front+banco estavam mortos/inexistentes. Provável: SQL manual histórico ou código antigo já revertido. Mesmo assim a arma carregada (hook morto) foi removida pra fechar a porta.
- **Read-only MCP funcionou:** `apply_migration` da view foi bloqueada pelo servidor MCP (como esperado), forçando rodar manual no SQL editor. Salvaguarda OK.

**SQL pra rodar no SQL editor do Supabase (cria a view MON-001):**
```sql
CREATE OR REPLACE VIEW public.processos_zombies AS
SELECT
  p.id              AS processo_id,
  p.razao_social,
  p.etapa,
  p.cliente_id,
  c.nome            AS cliente_nome,
  p.valor,
  p.created_at,
  p.empresa_id
FROM public.processos p
LEFT JOIN public.clientes c ON c.id = p.cliente_id
WHERE p.etapa IN ('concluido', 'finalizados')
  AND COALESCE(p.is_archived, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.lancamentos l
    WHERE l.processo_id = p.id
  );

COMMENT ON VIEW public.processos_zombies IS
'Sentinela MON-001: processos em etapa terminal sem lancamento. Idealmente sempre vazia.';
```

**SQL pra rodar no SQL editor do Supabase (cria a RPC FEAT-001):**
```sql
CREATE OR REPLACE FUNCTION public.marcar_processo_pago(
  p_processo_id uuid,
  p_data_pagamento date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_proc_empresa uuid;
  v_proc_cliente uuid;
  v_proc_valor numeric;
  v_proc_tipo text;
  v_proc_razao text;
  v_lanc_id uuid;
BEGIN
  -- Tenant check (mesmo padrão de criar_processo_com_lancamento)
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  SELECT empresa_id, cliente_id, valor, tipo::text, razao_social
    INTO v_proc_empresa, v_proc_cliente, v_proc_valor, v_proc_tipo, v_proc_razao
    FROM public.processos
   WHERE id = p_processo_id;

  IF v_proc_empresa IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_proc_empresa != v_empresa_id THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  -- Busca lancamento receber do processo (pega o mais antigo se houver mais de um)
  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id AND tipo = 'receber'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_lanc_id IS NOT NULL THEN
    -- Atualiza lancamento existente (promoção a 'pago' nunca rebaixa nada)
    UPDATE public.lancamentos
       SET status = 'pago'::public.status_financeiro,
           etapa_financeiro = 'honorario_pago',
           confirmado_recebimento = true,
           data_pagamento = p_data_pagamento,
           updated_at = NOW()
     WHERE id = v_lanc_id;
  ELSE
    -- Caso edge: processo sem lancamento (não deveria acontecer no fluxo
    -- normal pós criar_processo_com_lancamento, mas cobre legados)
    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, data_pagamento, etapa_financeiro, empresa_id,
      confirmado_recebimento
    )
    VALUES (
      'receber'::public.tipo_lancamento,
      v_proc_cliente,
      p_processo_id,
      INITCAP(v_proc_tipo) || ' - ' || v_proc_razao,
      COALESCE(v_proc_valor, 0),
      'pago'::public.status_financeiro,
      p_data_pagamento,
      p_data_pagamento,
      'honorario_pago',
      v_empresa_id,
      true
    )
    RETURNING id INTO v_lanc_id;
  END IF;

  -- Promove processo a 'finalizados' (espelha ja_pago=true do cadastro)
  UPDATE public.processos
     SET etapa = 'finalizados',
         updated_at = NOW()
   WHERE id = p_processo_id;

  RETURN v_lanc_id;
END;
$function$;

COMMENT ON FUNCTION public.marcar_processo_pago(uuid, date) IS
'FEAT-001 (11/05/2026): marca processo como pago retroativamente. Atualiza/cria lancamento e promove processo a finalizados. Mesmo comportamento do ja_pago=true do cadastro.';
```

**SQL pra rodar no SQL editor (relaxa constraint DATA-006):**
```sql
-- Antes: CHECK (valor > 0) NOT VALID — bloqueava UPDATE em lancamentos com valor 0
-- (processos de cortesia, mensalistas dentro de franquia). 8 registros legados.
-- Depois: CHECK (valor >= 0) — aceita zero, mantém proteção contra negativos.
ALTER TABLE public.lancamentos DROP CONSTRAINT IF EXISTS lancamentos_valor_positivo_check;
ALTER TABLE public.lancamentos
  ADD CONSTRAINT lancamentos_valor_nao_negativo_check CHECK (valor >= 0);
```

**SQL pra rodar no SQL editor (cria as RPCs FEAT-002 + FEAT-003):**
```sql
-- FEAT-002: marca processo como deferido (atualiza processo + promove lancamento).
CREATE OR REPLACE FUNCTION public.marcar_deferimento(
  p_processo_id uuid,
  p_data_deferimento date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_caller uuid;
  v_processo RECORD;
  v_lanc_id uuid;
  v_vencimento date;
BEGIN
  v_empresa_caller := public.get_empresa_id();

  SELECT id, cliente_id, razao_social, tipo, valor, empresa_id, data_deferimento
    INTO v_processo
    FROM public.processos
   WHERE id = p_processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_processo.empresa_id <> v_empresa_caller THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  UPDATE public.processos
     SET data_deferimento = p_data_deferimento,
         updated_at = NOW()
   WHERE id = p_processo_id;

  v_vencimento := public.calcular_vencimento(v_processo.cliente_id);

  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
     AND etapa_financeiro = 'aguardando_deferimento'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  IF v_lanc_id IS NOT NULL THEN
    UPDATE public.lancamentos
       SET etapa_financeiro = 'solicitacao_criada',
           data_vencimento  = v_vencimento,
           updated_at       = NOW()
     WHERE id = v_lanc_id;
    RETURN jsonb_build_object('ok', true, 'acao', 'promovido', 'lancamento_id', v_lanc_id);
  END IF;

  -- Fallback legado: processo sem lancamento (não deveria acontecer pós-fix LUANNA)
  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, created_at, etapa_financeiro, empresa_id
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_processo.cliente_id,
    p_processo_id,
    INITCAP(v_processo.tipo::text) || ' - ' || v_processo.razao_social || ' (Deferido)',
    COALESCE(v_processo.valor, 0),
    'pendente'::public.status_financeiro,
    v_vencimento,
    NOW(),
    'solicitacao_criada',
    v_processo.empresa_id
  )
  RETURNING id INTO v_lanc_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'criado', 'lancamento_id', v_lanc_id);
END;
$function$;

COMMENT ON FUNCTION public.marcar_deferimento(uuid, date) IS
'FEAT-002 (11/05/2026): marca processo como deferido direto da tela do cliente. Espelha o DeferimentoModal de lote.';

-- FEAT-003: desfaz deferimento marcado por engano. Guard anti-rebaixamento.
CREATE OR REPLACE FUNCTION public.desfazer_deferimento(
  p_processo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_caller uuid;
  v_processo_empresa uuid;
  v_lanc_id uuid;
  v_lanc_etapa text;
BEGIN
  v_empresa_caller := public.get_empresa_id();

  SELECT empresa_id INTO v_processo_empresa
    FROM public.processos
   WHERE id = p_processo_id;

  IF v_processo_empresa IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_processo_empresa <> v_empresa_caller THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  -- Guard: bloqueia se lançamento já saiu pra cobranca_enviada ou foi pago
  -- (consistente com a guard DERMAE em 4 caminhos do front).
  SELECT id, etapa_financeiro::text
    INTO v_lanc_id, v_lanc_etapa
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  IF v_lanc_id IS NULL THEN
    RAISE EXCEPTION 'Processo sem lançamento de receber';
  END IF;
  IF v_lanc_etapa IN ('cobranca_enviada', 'honorario_pago') THEN
    RAISE EXCEPTION 'Lançamento já foi enviado/pago — não pode rebaixar (etapa: %)', v_lanc_etapa;
  END IF;

  UPDATE public.processos
     SET data_deferimento = NULL,
         updated_at       = NOW()
   WHERE id = p_processo_id;

  UPDATE public.lancamentos
     SET etapa_financeiro = 'aguardando_deferimento',
         data_vencimento  = '2099-12-31'::date,
         updated_at       = NOW()
   WHERE id = v_lanc_id;

  RETURN jsonb_build_object('ok', true, 'lancamento_id', v_lanc_id);
END;
$function$;

COMMENT ON FUNCTION public.desfazer_deferimento(uuid) IS
'FEAT-003 (11/05/2026): desfaz deferimento marcado por engano. Guard anti-rebaixamento.';
```

**SQL pra rodar no SQL editor (desfaz deferimento errado DATA-007 — RCB antigo da FATO):**
```sql
-- Reverte deferimento marcado por engano. Cliente FATO é no_deferimento;
-- lançamento volta pra estado original "aguardando deferimento" com placeholder
-- de vencimento. data_deferimento do processo é limpa. Etapa operacional
-- (registro) preservada — financeiro e operacional são independentes.
UPDATE public.lancamentos
   SET etapa_financeiro = 'aguardando_deferimento',
       data_vencimento  = '2099-12-31'::date,
       updated_at       = NOW()
 WHERE id = '9399d050-897a-4d96-b980-f24cbab67ed4';

UPDATE public.processos
   SET data_deferimento = NULL,
       updated_at       = NOW()
 WHERE id = '080872dc-e02c-4f15-bbef-88fcb0b252e4';
```

---

## 🧨 AUDITORIA SISTÊMICA — 07/05/2026 (Thales pediu *"auditoria extremamente completa e complexa"*)

Varredura por subagent Explore em 7 vetores: SEGURANÇA, PERFORMANCE, CONFIABILIDADE, ACESSIBILIDADE, UX/FRONTEND, DADOS/BACKEND, INFRA/DEPLOY. **38 achados novos** (não duplicam itens das seções anteriores deste doc).

**Distribuição:** 1 CRÍTICO · 28 IMPORTANTE · 9 NICE.

### 🟢 Sprint 1 — atacados em 07/05 (durante ausência do Thales)

| ID | Status | Commit |
|---|---|---|
| SEC-004 | ✅ FIXADO — 4 catches silenciosos viraram `console.warn` | `5f31956` |
| INFRA-001 | ✅ FIXADO — sourcemap explícito false em prod | `ae2b4bf` |
| REL-001/SEC-005 | ✅ PARCIAL — util `lib/clipboard.ts` com fallback iOS/HTTP, refatorados 2 modais financeiros (resto admin-only, baixo risco) | `e3a4478` |
| REL-006 | ✅ FIXADO — `verificarSenha` agora checa `res.ok` antes de parsear JSON | `aaed956` |
| REL-002 | ✅ FIXADO — `readRangeStored` wrapped em try/catch (iOS Safari modo privado) | `aaed956` |
| REL-007 | ✅ FIXADO — `ContractDropzone` setTimeout com cleanup via useRef + useEffect | `aaed956` |
| REL-003 | ⚠️ FALSO ALARME — todos `parseFloat` já têm `\|\| 0` (NaN é falsy) ou `isNaN()` guard |  |
| REL-004 | ⚠️ FALSO ALARME — `localStorage.setItem` na CobrancaPublica já está em try/catch |  |
| REL-005 | ⚠️ FALSO ALARME — blobs criados localmente nunca null (`new Blob()` garantido) |  |
| REL-008 | ⚠️ FALSO ALARME — `useHighlightOnModal` já tem `return () => clearTimeout(t)` |  |
| A11Y-001 | ⚠️ FALSO ALARME — ambos `<img>` (ContractPreviewModal, PortfolioPublico) já têm `alt` |  |
| INFRA-007 | ⚠️ FALSO ALARME — comentário no AuthContext é relevante (fix #14, #20), não obsoleto |  |

**Fora de escopo (decisão Thales):** PERF-001 (otimização de imagens — destrutivo, requer ferramenta externa), DATA-001 (migration SQL — Lovable controla), PERF-002 (god components — refactor amplo), SEC-001/002/003 (`dangerouslySetInnerHTML` — design decision atual aceita).

### 🟢 Sprint 2 — atacados em 07/05 (rodada 2, ao vivo com Thales)

| ID | Status | Commit |
|---|---|---|
| UX-003 | ⚠️ FALSO ALARME — todos os 4 botões de aprovar/recusar já têm `disabled={processando}` |  |
| UX-004 | ⚠️ FALSO ALARME — todos os 14 arquivos com AlertDialog já usam `AlertDialogDescription` |  |
| A11Y-003 | ✅ PARCIAL — `aria-label` em 5 icon buttons sem title (Processos, Orcamentos, NotificationPopover, NovoClienteInline, FilaBatch). Demais ~40 já têm `title=` (fallback aceitável) | `c51d1f3` |
| A11Y-005 | ✅ FIXADO — `aria-current="page"` nos `SidebarMenuButton`/`SidebarMenuSubButton` quando isActive | `c51d1f3` |
| PERF-005 | ✅ FIXADO (via manual chunks) — `jspdf`/`html2canvas`/`d3` em chunks vendor separados pra cache long-term. Dynamic import dentro das libs pulado (refactor pesado, ROI baixo) | `849fb03` |
| INFRA-003 | ✅ FIXADO — 2 `console.log` removidos (audit citou 40 mas só restavam 2) + ESLint `no-console` warn rule | `45f1b0f` |

### 🟢 Sprint 3 — atacados em 07/05 (rodada 3, com aprovação Thales)

| ID | Status | Commit |
|---|---|---|
| PERF-001 | ✅ FIXADO — 6.5MB economizados: 2 PNGs órfãos deletados (3.3MB) + dani-avatar/trevo-logo redimensionados pra 512px (3.2MB) | `78c0f2e` |
| DATA-001 | ⚠️ FALSO ALARME — `MIGRATION-cartao.sql` JÁ TEM `idx_cartao_compras_cartao_fatura` e `idx_cartao_faturas_cartao_status` |  |
| DATA-002 | ⚠️ FALSO ALARME — RLS habilitada + policies `cartoes_authenticated_all`, `cartao_compras_*`, `cartao_faturas_*` já criadas |  |
| PERF-002 | ⏸️ NÃO ATACAR — refactor de god components (2549/2302l) sem ROI claro. Atacar só se bater bug específico ou feature nova nessas telas |  |
| SEC-001/002/003 | ⏸️ NÃO ATACAR — `dangerouslySetInnerHTML` com CSS estático (constante `GLASS_CSS`). Risco XSS = ZERO porque conteúdo não vem de input do user. Audit flagou só por padrão de código |  |

### 🟢 Sprint 4 — atacados em 07/05 (rodada 4, batch baixo risco)

| ID | Status | Commit |
|---|---|---|
| SEC-006 | ✅ FIXADO — `geo-cache.ts` reescrito com Map + LRU (max 50) + TTL (30min). Não vaza mais memória em SPA long-lived | `5e791d8` |
| A11Y-004 | ✅ FIXADO — `@media (prefers-reduced-motion: reduce)` global em `index.css` cobre TODAS animações (confetti, dashFadeInUp, logoPulse, trevoWave, municipioPulse, card-hover) | _este commit_ |
| SEC-007 | ⚠️ FALSO ALARME — `ContractDropzone.tsx` já tem `ACCEPTED_TYPES` (PDF/JPG/PNG/DOCX) + `MAX_SIZE` 10MB via react-dropzone |  |
| PERF-004 | ⚠️ FALSO ALARME — `salvarSelecaoSilencioso` já usa `saveTimer` como `useRef`, e args (sel/vals/allItens) são passados como parâmetros frescos, não capturados por closure |  |

### 🟢 Sprint 5 — atacados em 07/05 (rodada 5, limpeza)

| ID | Status | Commit |
|---|---|---|
| INFRA-006 | ✅ FIXADO — deletado `src/App.css` (scaffolding default Vite, ZERO imports no projeto, levava `logo-spin` keyframe + `.read-the-docs` morto) | _este commit_ |
| PERF-006 | ⚠️ FALSO ALARME — Catalogo renderiza Level0/1/2/SearchResults/ServiceDetail um por vez via condicional + `key={animKey}` força remount. memo() não ajuda quando só 1 mounta de cada vez. ItemCardSimples/Detalhado vivem em OrcamentoNovo, não Catalogo (audit confundiu) |  |

### 📊 Balanço final auditoria sistêmica

**38 achados originais:**
- ✅ 14 fixados (sprint 1+2+3+4+5)
- ⚠️ 15 falsos alarmes (já estavam corretos no código)
- ⏸️ 5 não atacar (custo > benefício ou sem risco real)
- 🔄 4 restantes — todos exigem decisão/refactor médio: UX-001/002/006 (god components), A11Y-002 (contraste — auditoria visual com devtools), DATA-003/004 (refactor + DB), INFRA-002/004/005 (decisões), SEC-008 (env vars — risco com Lovable), UX-005 (sticky col mobile — caso a caso)

**Insight:** ~39% dos achados eram falsos alarmes. A auditoria automática do subagent foi superficial em vários itens — útil pra catálogo, mas precisa validação humana antes de atacar.

**Próximos passos sugeridos:** os 4 restantes não são "batch friendly" — cada um pede ou (a) sessão dedicada com screenshots/devtools, (b) decisão estratégica do Thales, ou (c) refactor médio (>1h) com risco de regressão. Atacar só sob demanda específica ou quando bater bug real na área.

### 🔴 CRÍTICO (1)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **SEC-004** | `src/pages/PropostaPublica.tsx:306–414` | 4 promises com `.catch(() => {})` silencioso em RPCs (`criar_evento_proposta`, `salvar_selecao_proposta`, `verificar_senha_proposta`). Padrão que **já queimou em P0.3.1** — auto-folha falhou silencioso por 1 mês. | `.catch(e => console.error('RPC X falhou:', e))` + toast.error se ação for crítica. |

### 🟡 IMPORTANTE — Segurança (4)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **SEC-001** | `src/pages/PortfolioPublico.tsx:228` | `dangerouslySetInnerHTML` em `<style>` com `GLASS_CSS`. Anti-padrão. | Mover CSS pra arquivo `.css` importado. |
| **SEC-002** | `src/pages/Catalogo.tsx:188` | Mesma coisa, duplicado. | Extrair `GLASS_CSS` em CSS único compartilhado. |
| **SEC-003** | `src/components/ui/chart.tsx:70` | `dangerouslySetInnerHTML` em template CSS dinâmico. | Usar CSS custom properties via `style={}`. |
| **SEC-007** | `src/components/contratos/ContractDropzone.tsx`, `ContractPreviewModal.tsx` | Upload de contratos sem validação MIME/tamanho. | `file.type === 'application/pdf' && file.size < 50_000_000`. |

### 🟡 IMPORTANTE — Performance (3)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **PERF-001** | `src/assets/` | 8 imagens PNG > 250KB, 3 > 1MB (dani-avatar 1.4MB, dani-logo-dark 1.4MB, trevo-logo 1.9MB). Impacto direto em FCP. | TinyPNG/WebP + lazy loading. |
| **PERF-002** | `ClienteDetalhe.tsx` (2549 linhas), `ClienteAccordionFinanceiro.tsx` (2302), `OrcamentoNovo.tsx` (1253), `PropostaPublica.tsx` (1142) | 4 god components > 1000 linhas com 30-59 useState cada. | Quebrar em sub-componentes. |
| **PERF-004** | `src/pages/PropostaPublica.tsx:317–329` | `salvarSelecaoSilencioso` com debounce em `useCallback([token])` — closures antigos vazam. | `useRef` pro timer + cleanup em useEffect. |

### 🟡 IMPORTANTE — Confiabilidade (8)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **SEC-005 / REL-001** | 7 arquivos (`ValoresAdicionaisModal.tsx:195`, `WhatsappLinkButton.tsx:55`, `ClienteAccordionFinanceiro.tsx:63,2040`, `ClientesContestados.tsx:34`, `lib/storage-utils.ts:90`) | `navigator.clipboard.writeText()` com `.catch(() => {})` silencioso. Sem feedback de falha de cópia em iframes. | `.catch(() => toast.error('Falha ao copiar'))`. |
| **REL-002** | `src/components/contas-pagar/FluxoProximos15Dias.tsx:46` | `parseInt(localStorage.getItem(...) || '15', 10)` sem try/catch nem isNaN guard. | `try { const v = parseInt(...); return isNaN(v) ? 15 : v } catch { return 15 }`. |
| **REL-003** | 10+ inputs (`ValoresAdicionaisModal:105,128`, `ClientesAuditoria:492`, `PacotesEditor:86`, `ItemCardSimples:32`, `ItemCardDetalhado:49–147`, etc) | `parseFloat(e.target.value)` sem guard NaN. Cálculos viram NaN silenciosamente. | `parseFloat(e.target.value) || 0`. |
| **REL-005** | `src/lib/extrato-pdf.ts`, `orcamento-pdf.ts`, `relatorio-*.pdf.ts` | `URL.createObjectURL(blob)` sem null check. | `if (!blob) { toast.error('Erro PDF'); return }`. |
| **REL-006** | `src/pages/PropostaPublica.tsx:356` | `await res.json()` sem `res.ok` check. Erro 4xx/5xx vira success. | `if (!res.ok) throw new Error(res.statusText)`. |
| **REL-007** | `src/components/contratos/ContractDropzone.tsx:39` | `setTimeout` sem cleanup → setState em componente desmontado. | `useEffect cleanup return clearTimeout(id)`. |
| **REL-008** | `src/hooks/useHighlightOnModal.ts:22` | Mesmo padrão, sem cleanup. | Mesmo fix. |
| **SEC-006** | `src/lib/geo-cache.ts` | Cache GeoJSON in-memory sem TTL nem limite. Vaza memória em SPA long-lived. | LRU `maxEntries: 50` + TTL 30min. |

### 🟡 IMPORTANTE — Acessibilidade (3)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **A11Y-001** | `ContractPreviewModal.tsx:59`, `PortfolioPublico.tsx:232` | 2 `<img>` sem `alt`. WCAG 1.1.1. | `alt="Prévia do contrato"`. |
| **A11Y-002** | Global (483 ocorrências de `text-muted-foreground`) | Possível contraste < 4.5:1 (WCAG AA). | Auditoria com devtools color contrast checker. |
| **A11Y-003** | `Processos.tsx`, `Financeiro.tsx`, `ClienteDetalhe.tsx` | Buttons só com ícone sem `aria-label`. WCAG 4.1.2. | `aria-label="Editar configurações"`. |

### 🟡 IMPORTANTE — UX (4)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **UX-001** | `ClienteDetalhe.tsx` | 59+ useState sem agrupamento por seção. | Comentários `// ── Data Loading ──` etc. |
| **UX-002** | `ItemCardDetalhado.tsx` (157l) + `ItemCardSimples.tsx` (80l) | 90% de sobreposição entre os 2. | `<OrcamentoItemCard variant="simples"\|"detalhado">`. |
| **UX-003** | `PropostaPublica.tsx:397–440` | `handleAprovar()` sem loading state — usuário clica 2x. | `setProcessando(true)` + `<Button disabled={processando}>`. |
| **UX-004** | Global (Financeiro, Processos, ClienteDetalhe) | AlertDialogs sem descrição clara da ação. Risco de delete acidental. | `<AlertDialogDescription>` sempre com "ação irreversível". |

### 🟡 IMPORTANTE — Dados/Backend (3)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **DATA-001** | `MIGRATION-cartao.sql`, `MIGRATION-cartao-tipo.sql` | Migrations sem índice em `cartao_id` foreign key. | `CREATE INDEX IF NOT EXISTS idx_cartao_faturas_cartao_id ON cartao_faturas(cartao_id)`. |
| **DATA-002** | Modelo cartão (cartoes, cartao_compras, cartao_faturas) | RLS habilitada não confirmada. **Risco multi-tenant**. | Verificar `ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY` + policy auth.uid. |
| **DATA-003** | `src/lib/observacao-processo.ts` | Regex `AUTO_META_PATTERNS` hardcoded 4 etapas; não escalável. | ENUM no DB + query em runtime. |

### 🟡 IMPORTANTE — Infra (3)

| ID | Arquivo:linha | Descrição | Fix |
|---|---|---|---|
| **INFRA-001** | `vite.config.ts` | `build.sourcemap` não desabilitado em prod. Vaza código original. | `build: { sourcemap: false }`. |
| **INFRA-002** | `package.json` script `build:dev` | Build sem minificação; se deployado por engano vira bundle 3-5x maior + console.log. | Documentar: prod usa `build` apenas. |
| **INFRA-003** | Global (40 console.log) | Debug statements em código fonte. Vaza dados em DevTools prod. | ESLint `no-console: ["error", { allow: ["warn", "error"] }]`. |

### 🟢 NICE TO HAVE (9)

| ID | Item | Local |
|---|---|---|
| **SEC-008** | `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` hardcoded em `client.ts` | Migrar pra `import.meta.env.VITE_*`. |
| **PERF-005** | PDFs (4 libs jsPDF+autotable+html2canvas+d3) bundled sempre | Dynamic import nas funções de geração. |
| **PERF-006** | `Catalogo.tsx` (1057 linhas) sem `memo()` em sub-componentes | Envolver `ItemCardSimples`, `ItemCardDetalhado` em memo. |
| **REL-004** | CobrancaPublica `localStorage.setItem` sem confirmação de sucesso (já tem try/catch no get) | Mover try/catch pra cobrir setItem também. |
| **A11Y-004** | Outras animações no app (tooltips, fade) não respeitam `prefers-reduced-motion` (só confetti respeita) | Helper `respectsReducedMotion()` global. |
| **A11Y-005** | `src/components/ui/sidebar.tsx` (637 linhas) sem `aria-expanded`/`aria-current` | Adicionar nos collapsible groups. |
| **UX-005** | Tabelas mobile com 8+ colunas scrolláveis sem indicator visual | `sticky left-0` na 1ª col + sombra. |
| **UX-006** | `OrcamentoNovo.tsx` (1253l) sem seções visuais | Tabs ou sticky header com índice. |
| **DATA-004** | `classificarPagamento()` duplicado no front | View no Supabase com `pagamento_status` computado. |
| **INFRA-004** | `@testing-library/jest-dom` instalado mas zero testes escritos | Implementar OU remover. |
| **INFRA-005** | D3 (~60KB) usado em 2 componentes só | Avaliar Leaflet (14KB). |
| **INFRA-006** | `tailwindcss-animate` keyframes podem estar fora do tailwind.config | Auditar `globals.css`. |
| **INFRA-007** | `AuthContext.tsx:38–61` comentário obsoleto sobre `setInterval` antigo | Remover comentário. |

### 🛣️ Roadmap sugerido

**Sprint 1 (1-2 dias, alto impacto baixo risco)**
1. SEC-004 (catch silencioso em PropostaPublica) — **único CRÍTICO**
2. SEC-005/REL-001 (clipboard sem feedback — 7 arquivos, fix mecânico)
3. REL-003 (parseFloat NaN guard — 10+ inputs)
4. INFRA-001 (sourcemap off em prod)
5. PERF-001 (otimizar 3 imagens > 1MB)
6. DATA-001 (índices nos cartoes_*)

**Sprint 2 (1 semana)**
- DATA-002 (RLS cartões — pré-requisito segurança multi-tenant)
- REL-007/REL-008 (cleanup de timers)
- A11Y-001 (alt nas imagens) + A11Y-003 (aria-label nos buttons)
- INFRA-003 (ESLint no-console)

**Sprint 3 (refactor maior)**
- PERF-002 (quebrar god components)
- UX-002 (unificar OrcamentoItemCard)
- DATA-003 (ENUM tipo_processo no DB)
- PERF-005 (dynamic import PDFs)

---

## 🔬 AUDITORIA 2 — `/cobranca/:token` (07/05/2026, requisitada por Thales pós-CB-6)

Spec Thales: *"Agora faca mais uma auditoria! e atualize esse md"*. Critério: tudo que for seguro corrigir agora atacado, resto deferido com motivo. Plano descoberto **13 itens**, atacados **7 críticos+rápidos**, deferidos **6**.

### 🔴 Críticos & 🟡 rápidos atacados ([`71f011f`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/71f011f))

| ID | Item |
|---|---|
| **A2-1** | **UI mentindo no Histórico**. Texto era hardcoded `"Esta é a primeira cobrança que você recebe da Trevo Legaliza"`. Cliente que recebe a 10ª cobrança via mesma frase. **Fix**: substituído por data real `Cobrança emitida em DD/MM/YYYY HH:MM · Vence em DD/MM/YYYY` (sempre verdadeira sem precisar mexer no RPC). |
| **A2-2** | **Tautologia na frase Dani** (`"...processos desta cobrança ou sobre essa cobrança?"`). Repetia "cobrança" 2x na mesma frase. **Fix**: 2ª ocorrência → "ou sobre o pagamento" (singular e plural). |
| **A2-3** | **`detail-tag` mostrando tipo raw** (sem normalização). Dizia "alteracao" sem ç enquanto a frase Dani logo abaixo dizia "alteração" com ç — inconsistência visível na mesma página. **Fix**: aplicar `normalizarProcesso()` também na detail-tag. |
| **A2-4** | **Status pill verde-tranquilo contradizia due chip âmbar** quando faltam 2-3 dias. Header dizia "Cobrança ativa" enquanto a due chip dizia "Vence em 2 dias" em âmbar. **Fix**: status pill agora é `warning` âmbar quando `diffDias <= 3`. |
| **A2-5** | **`empresa.whatsapp` sem normalização** no link `wa.me/`. Se DB tem máscara `"(11) 93492-7001"`, link `wa.me/(11)%2093492-7001` quebra silenciosamente — usuário clica e WhatsApp abre tela vazia. **Fix**: helper `onlyDigits()` strip não-dígitos antes de montar URL. Aplicado nos 2 wa.me (card Dani + tela cobrança cancelada). |
| **A2-6** | **`saudacao` sem fallback** — se `cliente_apelido` E `cliente_nome` estão vazios, renderiza `"Olá, ."` quebrado (sim, com a vírgula órfã). **Fix**: fallback `'tudo bem'` (saudação neutra que não exige nome). |
| **A2-7** | **Confetti ignora `prefers-reduced-motion`** — pessoas com sensibilidade vestibular veem animação 4.5s sem opt-out. **Fix**: `dispararConfetti()` faz `return` early se `matchMedia('(prefers-reduced-motion: reduce)').matches`. Padrão WCAG 2.3.3. |

### 🟢 Deferidos (próximos rounds)

| ID | Item | Razão deferida |
|---|---|---|
| **A2-8** | **Sem Realtime** — cliente paga olhando a página, confetti só dispara em refresh. Cliente espera 30s+ sem feedback visual de que pagamento foi confirmado. | Precisa subscription Supabase Realtime em `cobrancas` filtrado por token. **Pré-requisito**: `ALTER PUBLICATION supabase_realtime ADD TABLE cobrancas;` no Supabase. Validar com Thales. |
| **A2-9** | **`baixarExtrato` sem timeout** (sem `AbortController`). Edge function `cobranca-pdf` lenta deixa botão Baixar PDF travado indefinidamente. | Risco baixo (PDF rápido), mas vale `AbortSignal.timeout(15000)` num próximo round. |
| **A2-10** | **Confetti dispara em todo refresh** se status já é `paga`. Cliente que volta na página vê confetti repetido. | Solução: localStorage `confetti_disparado:${cobranca.id}` com TTL. Polish, não bug. |
| **A2-11** | **A11y tabs**: `role="tab"` sem `aria-controls` apontando pro panel correspondente. Screen reader não consegue navegar tab → panel. | Refactor: dar IDs aos `pay-panel` (`#panel-pix`, `#panel-boleto`) e `aria-controls` nos buttons. Pequeno mas mexe estrutura. |
| **A2-12** | **Token Asaas em URL query** já listado em **C40** da seção Críticos da auditoria principal. | Bloqueado: stripping de headers customizados pelo Apps Script (cross-repo). |
| **A2-13** | **`pix_payload` longo** (90+ chars) pode quebrar layout em viewport <360px. Não verifiquei em mobile estreito real. | Precisa `word-break: break-all` no `.pix-code` se confirmar. Test manual em mobile primeiro. |

### Decisões / cuidados

- **Histórico (A2-1)**: optei por NÃO criar campo `é_primeira_cobranca` no RPC porque (a) info redundante (basta `created_at` da cliente) e (b) próximo round vai querer "Última cobrança paga: DD/MM" — melhor refazer estrutura uma vez só. A frase nova é sempre verdadeira sem custo.
- **A2-2 (frase Dani)**: tentei "ou sobre algum detalhe" antes mas ficou genérico demais. "Sobre o pagamento" mantém o foco transacional da página.
- **A2-7 (a11y confetti)**: `dispararConfetti()` checa `window.matchMedia` defensivo (SSR-safe pra futuro), mesmo o app sendo SPA. Custo zero.

---

## 🆕 LOTE COBRANÇA-PÚBLICA — 06–07/05/2026 (página `/cobranca/:token` + preview WhatsApp)

Spec inicial Thales (06/05 noite): *"Refiz o HTML no Claude design e demorei horas mexendo nele. Quero que voce importe exatamente esse zip!"* → 2 iterações de design (1ª descartada após review do mobile, 2ª aprovada via `index-ed37df5d.html`) → auditoria detalhada com 3 screenshots → preview do link no WhatsApp passou por 3 ciclos.

Página é `https://cobranca.trevolegaliza.com/cobranca/:token` — link que o cliente recebe pelo WhatsApp pra pagar.

### Itens entregues

| ID | Item | Commit |
|---|---|---|
| **CB-1** | Design v1 (zip `LP (1).zip` — Orbitron + mono uppercase + dani-logo horizontal grande). Implementado, deployado, **mas Thales viu no mobile e pediu redesign** ("ainda não está na versão nova"). | [`6479de6`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6479de6) |
| **CB-2** | Design v2 final (`index-ed37df5d.html`): Inter sans 56px no valor, **due chip com 3 variantes** (`is-soon` âmbar / `is-overdue` vermelho / verde default), pay-tabs full-width verde sólido no ativo, card Dani limpo com avatar circular 40px, nova seção **Histórico** com link "Baixar PDF" (chama edge function `cobranca-pdf`), meta-bar centralizada `Cobrança #xxx · Emitida em DD/MM/YYYY HH:MM`, footer Trevo \| divider \| dani®. | [`075a88e`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/075a88e) |
| **CB-3** | **Meta tags Open Graph corrigidas** — preview do link no WhatsApp mostrava print da tela de login do ERP (era a `og:image` antiga do Lovable preview, herdada do `index.html` do projeto). Trocado: `<title>` "Trevo Legaliza - ERP" → "Cobrança Trevo Legaliza"; description institucional → "Sua cobrança Trevo Legaliza. Pague via PIX ou Boleto em ambiente seguro"; `og:url` canônica adicionada. | [`1c78656`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/1c78656) |
| **CB-4 (auditoria Thales — RTF + 3 screenshots)** | **Card Dani**: removido nome "dani" ao lado do logo; role trocada de "Assistente IA da Trevo" → "Digital Assistant for National Incorporation"; helper `normalizarProcesso()` converte tipo do DB (lowercase sem acento) → exibição correta com acentos (`alteração`, `abertura`, `encerramento`, `transformação`); frase singular vs plural ("Tem dúvida referente ao processo de **X da Y**" vs "aos **processos desta cobrança**"). **Histórico**: conjunção corrigida — "Esta é a primeira cobrança que você recebe da Trevo Legaliza" (era "primeira cobrança da PROCESSO TESTE" — gramaticalmente quebrado). **Footer**: logo Trevo 40 → 64px (opacity 0.85 → 0.95); logo Dani 36 → 56px; ® aproximado da logo (gap 4 → 0px, margin-left -2px); divider 44 → 60px. **Pagamento confirmado**: animação confetti vanilla canvas (140 partículas, 4.5s, dispara 1x via useRef quando `status === 'paga'`) — sem dependência nova. | [`6a32643`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/6a32643) |
| **CB-5** | Preview WhatsApp formato pequeno. Antes era card grande (banner 1200×630), Thales pediu thumbnail compacta. `og:image` trocada pra 400×400, `twitter:card` `summary_large_image` → `summary`. Aplicado em `index.html` (estático) **e** no `useEffect` SEO de `CobrancaPublica.tsx` (que sobrescreve dinâmico no client). | [`578c376`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/578c376) |
| **CB-6** | Arte oficial do Thales (`og-cobranca-sm.png` 400×400, 220 KB) substitui o draft Python que tinha sido gerado. | [`c24c317`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/c24c317) |

### Decisões técnicas relevantes

- **Lovable é SPA estático (sem SSR)** → meta tags Open Graph são fixas no `index.html`. Não dá pra colocar nome do cliente / valor da cobrança no preview do WhatsApp (precisaria SSR ou edge function que retorna HTML). Aceito como tradeoff. O `useEffect` no `CobrancaPublica.tsx` sobrescreve `<title>` e meta-tags depois do load — funciona pra aba do navegador, **não funciona pro WhatsApp** (scraper só lê HTML estático).
- **Cache do WhatsApp ~7 dias** — depois do Publish, primeiros clientes podem ver preview antigo. Workaround: link com `?v=N` em conversa de teste força nova entrada no cache.
- **Confetti**: implementado vanilla pra evitar adicionar `canvas-confetti` (~50KB). 140 partículas + gravidade simples + rotação. CSS `.cobranca-confetti` `position:fixed; pointer-events:none; z-index:9999`. Limpa o `<canvas>` do DOM ao terminar.
- **`normalizarProcesso()` map** cobre só os 4 tipos canônicos (alteração/abertura/encerramento/transformação). "DEMAIS PROCESSOS" do brief Thales é tratado pelo fallback `raw.toLowerCase()`.

### Pendente

- **Publish no Lovable** — Thales vai apertar manualmente, não auto.
- **Verificar pós-deploy** no domínio real (`cobranca.trevolegaliza.com`) com cobrança ativa: due chip nos 3 estados, confetti em cobrança paga, og:image no [Facebook Debugger](https://developers.facebook.com/tools/debug/) (serve pra WhatsApp também).

---

## 🔥 HOTFIX MIG — 05/05/2026 (pós-migração Supabase)

Após Thales gerar primeira cobrança no Asaas no projeto Supabase novo (`aahhauquuicvtwtrxyan`), apareceram 2 bugs que estavam latentes da migração de 04/05.

### Itens entregues

| ID | Item |
|---|---|
| **MIG-1** | Regex `AUTO_META_PATTERNS` em `src/lib/observacao-processo.ts:32` não pegava strings com sufixo ` (N Processos)` depois da keyword. Resultado: textos internos tipo `Mudança de UF (2 Processos) \| Proc 2: R$ 551 + Proc 3: R$ 523` vazavam pra página pública de cobrança como "observação ao cliente". Adicionado grupo opcional `(\s*\(\d+\s*processos?\))?` na regex. |
| **MIG-2** | 4 lugares no front usavam `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` que não existem no novo projeto Lovable (URL é hardcoded em `src/integrations/supabase/client.ts`). Resultado: fetch ia pra `undefined/functions/v1/...` → 404. Refatorado: client.ts agora exporta `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`, e os 4 callers importam de lá. Arquivos: `CobrancaPublica.tsx` (botão Baixar extrato), `PropostaPublica.tsx`, `PortfolioPublico.tsx`, `GestaoUsuarios.tsx` (convite de usuário). |
| **MIG-3 (Notif A)** | Webhook `asaas-webhook/index.ts` agora insere row em `notificacoes` (tipo `pagamento`) ao receber `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, e `cobranca` ao receber `PAYMENT_OVERDUE`. SELECT de cobrança estendido pra trazer `empresa_id`, `total_geral` e `clientes.nome`. Frontend `NotificationPopover.tsx` ganhou subscription Realtime em `notificacoes` (event INSERT) que dispara toast (sonner) instantâneo + invalida query do sino, eliminando o gap de até 15s do `refetchInterval`. **Pré-requisito Lovable/Supabase**: `ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;` — se ainda não estiver na publicação, o INSERT chega no DB mas o toast não dispara. |
| **MIG-4** | Processo recém-criado não aparecia em `/financeiro` → "Aguardando Auditoria" mas aparecia em `/clientes/:id/faturas`. Causa raiz: `useCreateProcesso.onSuccess` em `useFinanceiro.ts:553` invalidava `['lancamentos']`, `['processos_db']`, `['dashboard_stats']`, `['processos_financeiro']` mas **esquecia** `['financeiro_clientes']` que alimenta `/financeiro`. Combinado com `staleTime: 300_000` (5 min) + `refetchOnMount: false` em `useFinanceiroClientes:409`, processos sumiam por até 5min em todas as telas que usavam essa query. **Fix**: (1) adicionado `invalidateFinanceiro(qc)` no onSuccess do `useCreateProcesso`; (2) `staleTime` reduzido pra 60s e `refetchOnWindowFocus: true` ativado — ERP financeiro multi-usuário precisa de janela curta de cache. |
| **MIG-5a** | Após cadastrar processo, só era possível editar `valor` e `observacoes_financeiro` via "Editar". Não havia UI pra ajustar `data_entrada` (`created_at`), `razao_social`, `tipo`, `prioridade`, `responsavel` ou `notas` — bloqueava correção de processos lançados com data errada (impacto direto na cadência de cobrança). **Fix**: novo modal `src/components/processos/ProcessoConfigEditModal.tsx` com todos esses campos. Plugado em `Processos.tsx` via novo item "Editar Configurações" no `QuickActionsMenu` (com ícone Settings; o item antigo "Editar" foi renomeado pra "Editar Financeiro" pra reduzir confusão). Mudança de `data_entrada` exibe AlertDialog avisando que vencimento do lançamento financeiro **não** será recalculado automaticamente (usuário ajusta na mão pelo modal financeiro depois — escolha intencional pra evitar surpresas em cobranças já enviadas). |
| **MIG-5b** | `/processos` mostrava colunas Razão Social, Cliente, Tipo, **Etapa**, Prioridade, Valor, Ações — sem indicador visual de pagamento. Thales achou que "Recebidos" (label da etapa de entrada do Kanban) significava "valor recebido" e ficou confuso. **Fix**: adicionada coluna **Pagamento** entre Etapa e Prioridade nas duas tabelas (agrupada e flat), com badge `Pago` (verde) / `Pendente` (âmbar) / `Vencido` (vermelho) / `—` (sem lançamento). Reaproveita o `pagamentoStatusMap` já existente (linha 213) e o `classificarPagamento()`. Helper `<PagamentoBadge>` no topo do arquivo pra evitar duplicação. `colSpan` do empty state corrigido 7→8. |
| **MIG-5c** | Mesma confusão de "Recebidos" + falta de editar config aparecia também em CLIENTES > :id > **Processos** (`ClienteDetalhe.tsx`). Tabela tinha 7 cols (checkbox/razao/tipo/etapa/prioridade/data/valor) e duplo-clique abria só o modal financeiro antigo. **Fix**: extraído `PagamentoBadge` + `classificarPagamento` pra módulo compartilhado `src/components/processos/PagamentoBadge.tsx` (reusado em /processos e ClienteDetalhe). Adicionada coluna Pagamento entre Etapa e Prioridade. Adicionada coluna Ações no fim com IconButton ⚙ Settings que abre `ProcessoConfigEditModal`. `Processos.tsx` refatorado pra importar do módulo compartilhado (eliminado duplicação de 30 linhas). |

### Bugs paralelos da migração — fixes manuais Thales

- Edge function `asaas-gerar-cobranca` falhava 403 em OPTIONS preflight: desativado "Verify JWT" no dashboard.
- CORS bloqueava `app.trevolegaliza.com`: configurado `ALLOWED_ORIGINS_EXTRA` nos secrets do Supabase (substituiu `CORS_FALLBACK_OPEN=true` que era brecha temporária).
- 13 cobranças órfãs (asaas_payment_id NULL pós-migração): SQL `UPDATE cobrancas SET asaas_payment_id=NULL, asaas_invoice_url=NULL, pix_payload=NULL` zerou tudo + Asaas account resetada (zero histórico real de pagamento). Cobranças serão regeradas via ERP conforme Thales auditar.

---

## 🆕 LOTE K — 04/05/2026 (UX Contas a Receber)

Após Thales pedir auditoria proativa de Contas a Receber (`/financeiro`) no mesmo molde do Lote J. Spec do Thales: *"Pode atacar tudo e quando finalizar avise me! Ai sim eu comeco minha auditoria"* — implementar tudo seguro antes da validação manual dele.

### Itens entregues

| ID | Item |
|---|---|
| **R0.1** | Removido accordion "Enviados" da aba Em Andamento. Era hardcoded `count=0` com mensagem "Nada por aqui ✨" — placeholder de feature que nunca foi implementada. Quando/se reativar, fluxo correto é cobranca_gerada → cobranca_enviada (já tracked em `etapa_financeiro`). |
| **R0.2** | Export CSV agora respeita aba ativa + filtros aplicados. Antes exportava `todosLancamentos` cru independente de onde o usuário estivesse. Filename ganha sufixo `_a_fazer` / `_em_andamento` / `_historico`. Toast de sucesso menciona contagem + aba. |
| **R1.1** | Busca livre em **A Fazer** e **Em Andamento** — input no topo de cada aba filtra por apelido/nome do cliente OU razão social do processo. Aplicado a todos os accordions internos (Auditoria, Cobrar, Mensalistas sem fatura, Próximas faturas, Aguardando, Contestados). Histórico já tinha; renomeado para "Buscar no histórico" pra reduzir confusão. |
| **R1.2** | Resumo do Mês trimmed. Removidos "Faturado" e "Recebido" (já aparecem nos KPIs em cima). Mantidos só os 2 deltas que importam: "Falta cobrar" e "Falta receber". |
| **R1.5** | Card "Projeção · próximos 30 dias" antes das Tabs. Mostra total previsto + qtd lançamentos + qtd clientes + top 3 clientes por valor. Olha pra frente (vs `Falta receber` que olha o filtro). Aparece só se houver lançamentos pendentes nos próximos 30d. |
| **R2.4** | Ranking dos top 5 pagadores no Histórico. Cada item mostra nome + valor recebido + qtd lançamentos + atraso médio (negativo = pagou adiantado). Computado em cliente sobre `clientesPagos` do período. |
| **R2.6** | "Buscar todos os lançamentos" → "Buscar no histórico" (nome era enganoso já que a busca é só dentro do período + aba). |
| **R2.7** | Aviso visual no modal "Confirmar Pagamento" quando valor ≥ R$ 3.000. Box âmbar lembrando irreversibilidade — alinhado com C3 do Lote J (que era pra Pagar). |

### Deferidos (round futuro)

- **R0.3** — métrica Inadimplente: já estava OK, falso alarme.
- **R1.3** — KPIs mais compactos no desktop: layout atual aceitável, defer pra polimento.
- **R1.4** — UI editar `observacoes_financeiro` por lançamento: campo já existe no DB, falta UI no `ClienteAccordionFinanceiro` (arquivo de 2.2k linhas; defer).
- **R1.6** — anexar comprovante PIX manual: precisa edit em `ClienteAccordionFinanceiro` + verificar coluna `comprovante_url` em `lancamentos`. Defer.
- **R2.1** — emoji ✨ nos placeholders: descartado (tom informal Thales tudo bem).
- **R2.2** — badges relativos HOJE/ATRASADO/EM Xd nos lançamentos: deep edit em `ClienteAccordionFinanceiro`. Hoje já tem "Vencido" badge via `isLancamentoVencidoReal`.
- **R2.3** — pular fim de semana/feriado na janela de cobrança: spec ambígua sem dependência clara. Defer até Thales reportar caso real.
- **R2.5** — ações em lote: irmão de F3 do Lote J (pendente). Defer pra coerência.
- **R-CONC** — conciliação OFX bancária: round 2 separado (gap estrutural).

---

## 🆕 LOTE J — 04/05/2026 (UX Contas a Pagar pós-uso real)

Após pagamento real do VT+VR de Maio/2026, Thales relatou: *"as duas colunas na mesma tela do financeiro mais atrapalharam do que ajudaram"*. Pediu auditoria proativa de UX. Plano: P0+P1+P2 + Gap Estrutural (conciliação bancária).

### Itens em ataque hoje
- **P0.1** — ✅ Coluna Urgência removida (Categoria full-width). VT+VR aggregate preservado em CategoriaAccordion.
- **P0.2** — ✅ Histórico agrega VT+VR (10 linhas → 5 BENEFÍCIOS). CSV mantém raw pro contador. Suporta 2 comprovantes distintos (caso pago individual com PDFs diferentes).
- **P1.5** — ✅ Comprovante quick-view padronizado. `ComprovanteLightbox` extraído pra arquivo próprio; usado em CategoriaAccordion, Histórico e Lista. Antes Histórico/Lista abriam em nova aba via `abrirArquivoStorage` — agora todos abrem modal in-place.
- **P2.6** — ✅ Tendência na Provisão. Cada card de mês futuro mostra variação % vs mês anterior (atual incluído como baseline). Seta vermelha = custo crescendo (ruim), verde = caindo (bom), traço = estável (<1%). Tooltip mostra valor do mês comparado.
- **P0.3** — ✅ Auto-importa folha quando muda mês ([`967dcb0`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/967dcb0)). Antes salário/adiantamento/VT/VR/DAS/FGTS/INSS só apareciam após clicar "Importar Folha" manualmente em Colaboradores. Cliente relatou 5º dia útil de Maio (8/5) invisível ao abrir Contas a Pagar. Agora `useEffect` em `ContasPagar.tsx` chama `gerarVerbasDoMes(ativos, ano, mês)` espelhando o padrão do `gerarLancamentosRecorrentes`. Função já era idempotente (upsert: atualiza pendente, pula pago, insere novo). Modal manual em Colaboradores fica como override.
- **P0.3.1** — ✅ Fix do catch silencioso ([`732d056`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/732d056)). O auto-trigger do `967dcb0` falhou silenciosamente em produção (Maio/2026 — cliente teve que importar manualmente, gerou 27 lançamentos que deveriam ter sido auto). `.catch(() => {})` engoliu a causa raiz. Agora `console.error` + `toast.error` com mensagem real. Falhas futuras visíveis na hora.

### Sub-lote 04/05 noite — auditoria UX 6 dimensões + cadastro de cartão

Após Thales pedir auditoria proativa de Funcionalidade / Visualização / Layout / Condição / Controle pós-pagamento / Recibos. Critério: atacar tudo que for seguro AGORA, deferir o que tem dependência ou escopo maior.

| ID | Item | Commit |
|---|---|---|
| F1+V2 | Cabeçalho de grupo de data mostra subcategoria (não dia da semana) + badge relativo HOJE/AMANHÃ/ATRASADO/EM Xd. Dia da semana virou tooltip. | [`39450b6`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/39450b6) |
| F4 | Chips de filtro rápido por data (Todas / Hoje / 7d) acima da lista de lançamentos. | [`cd5e6e7`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/cd5e6e7) |
| F4-polimento | Chips trocados por ToggleGroup (segmented control). 3 botões soltos não diferenciavam estado em light/dark — agora fundo unificado + shadow no ativo. | [`0ef3716`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/0ef3716) |
| C4 | Toast lembrete (1× por sessão) avisando que comprovante PDF/imagem cabe no upload — reduz fricção pós-pagamento. | [`33e27d5`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/33e27d5) |
| C3 | Pré-confirmação obrigatória para "Marcar como pago" quando valor ≥ R$ 3.000. AlertDialog com aviso de irreversibilidade. | [`d85fe6d`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/d85fe6d) |
| PP5 | Bloqueio de edição direta de lançamento já pago. AlertDialog "Editar mesmo assim" — sugere desfazer pagamento (round futuro PP1) como caminho correto. | [`8ed0f62`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/8ed0f62) |
| **PP1** | Desfazer pagamento dentro de janela 24h. Spec do Thales: só admin (`podeAprovar contas_pagar`), motivo opcional, sem histórico. Botão aparece no AlertDialog do PP5 quando `status='pago'` + admin + `updated_at <= 24h`. Diálogo separado pede confirmação com motivo opcional (descartado — sem histórico conforme spec). Volta para `status='pendente`, limpa `data_pagamento` e `comprovante_url`. | [`4cb2053`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/4cb2053) |
| **B1** | Modal "Nova Despesa" / "Editar Despesa": Conta Contábil + Centro de Custo escondidos atrás de Collapsible "Classificação contábil (opcional)". Abre automaticamente se já tiver valor preenchido (compatível com despesas antigas). Reduz overload do form que Thales nunca usa esses campos. | [`b434749`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/b434749) |
| **B3 / Cartão Fase 1** | Entidade nativa de cartão de crédito (substitui workaround "prefixar fornecedor com 'Cartão Trevo - '"). Schema: `cartoes`, `cartao_compras` (1 row por parcela), `cartao_faturas`. Migration em [`MIGRATION-cartao.sql`](MIGRATION-cartao.sql). Hooks `useCartoes`/`useCartaoCompras`. Página `/cartao` com cards listando cartões + form cadastro (nome, bandeira, últimos 4, dia fechamento, dia vencimento, limite). Item "Cartão" no sidebar. | [`7fed9cb`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/7fed9cb) |
| **Cartão Fase 2** | Lançar compra (à vista ou parcelada 1–24x) + visualização de fatura por mês. Página `/cartao/:id` com navegação ← / → entre meses, header com total/fechamento/vencimento, lista de compras com badge `parcela X/N`, exclusão (1 parcela só ou todas via `compra_grupo_id`). Helpers `calcularVencimentoFatura` / `somarMesesAoVencimento` / `calcularValoresParcelas` em `src/lib/cartao-fatura.ts`. Form de compra reusa `CATEGORIAS_DESPESAS` + Collapsible (B1 pattern) + preview ao vivo "Cai em N faturas". | [`9fd1bf0`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/9fd1bf0) |
| **Cartão Fase 3** | Fechar fatura → cria lançamento em Contas a Pagar (`tipo=pagar`, `categoria=infraestrutura`, `subcategoria=Cartão de Crédito`, `descricao=Fatura {nome} · {mês/ano}`). Status real consolidado por hook `useFaturaConsolidada` (lê `lancamentos.status` via FK `cartao_faturas.lancamento_id`). Badges: Aberta / Pronta para fechar / Fechada (em CP) / Paga. Botão "Reabrir fatura" deleta lançamento e desvincula compras (bloqueia se já pago). | [`7e9b04b`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/7e9b04b) |
| **Cartão Fase 4** | Tipo "Assinatura" + edição de compra + lembrete de expiração. Falha real: Thales tentou cadastrar Z-API.IO (SaaS R$ 99,99/mês) e o sistema dividiu em parcelas (R$ 16,66 × 6) — comportamento errado pra recorrência. **Migration**: nova coluna `tipo` em `cartao_compras` (`avista` / `parcelado` / `assinatura`) — em [`MIGRATION-cartao-tipo.sql`](MIGRATION-cartao-tipo.sql). **Form**: radio 3-vias com previews distintos (parcelado mostra divisão; assinatura mostra `Nx valor cheio`). **Edit**: modal `CompraEditModal` permite editar 1 row OU "aplicar a esta + futuras" (útil pra reajuste de assinatura mid-prazo); bloqueia mudança de valor se a fatura já foi fechada. **Lembrete**: alerta amarelo na `/cartao` listando assinaturas com última fatura ≤ 62 dias (renovação). Hook `useUpdateCompraGrupo` respeita `cartao_fatura_id IS NULL` pra não tocar em fatura fechada. | (commit pendente) |
| **CLT-salário-trigger** | Auto-folha re-dispara quando colaborador muda. Antes o guard era só `mês-ano` → editar `tipo_dia_salario` não disparava recálculo dos pendentes do mês visível (cliente teve que clicar "Importar Folha" manualmente em 04/05). Agora a key inclui hash de `dia_salario`, `tipo_dia_salario`, `dias VT/VR/DAS/adiantamento`, `salario_base`, `updated_at`. | [`47804ac`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/47804ac) |
| **CLT-salário** | Salário pode ser calculado pelo **Nº-ésimo dia útil** (CLT) ou dia do calendário (legado). Bug descoberto após Thales testar P0.3: salário caía 05/05 em vez de 08/05 (5º útil real, com 1/5 feriado). Novo campo `tipo_dia_salario` no cadastro do colaborador. Form ganha select "Dia útil (CLT)" / "Dia do mês" + texto auxiliar. `getNthDiaUtil(year, month, n, feriados)` em brasil-api.ts. **Migration SQL em [`MIGRATION-tipo-dia-salario.sql`](MIGRATION-tipo-dia-salario.sql) — Thales precisa rodar via Supabase SQL Editor.** Fallback seguro até a migration: comportamento legado ('calendario'). | [`1b49cef`](https://github.com/trevolegaliza-source/trevo-sparkle-share/commit/1b49cef) |
| V4 | Animação de "PIX copiado" — **já existia** em `PixInfo` linhas 91-95. Pulado. | (pré-existente) |
| L1 | Header sticky em listas longas — descartado por escopo maior (mexe em layout shell). Volta no round de polimento. | (deferido) |

### Backlog UX Pagar — adiado (round futuro)

Itens identificados na auditoria 6 dimensões mas **não atacados agora** por dependência, escopo ou risco.

**Funcionalidade**
- **F2** — Reordenar dentro de grupo de data (drag para priorizar quitação). Dep: lib de DnD.
- **F3** — Ações em lote (selecionar N → marcar pago / atribuir comprovante único). Risco contábil — exige revisão de fluxo.
- **F5** — Dividir um lançamento em parcelas pós-criação. Dep: schema de relacionamento.
- **F6** — Vincular lançamento a anexo de NF-e (XML). Dep: módulo de NF-e ainda não existe.

**Visualização**
- **V1** — Indicador de "fechado pelo contador" (lançamento congelado por mês contábil). Dep: ciclo contábil mensal não modelado.
- **V3** — Heatmap mensal (calendário com gradiente de carga). Escopo médio.
- **V5** — Avatar/ícone do colaborador no card de folha. Cosmético, sem urgência.

**Layout**
- **L2** — Densidade compacta/confortável togglável. Não pediu — só intuição.
- **L3** — Painel lateral com totais por categoria do mês visível. Sobrepõe filtros existentes.
- **L4** — Visão calendário (alternar lista ↔ calendário mensal). Escopo grande, lib nova.

**Condição**
- **C1** — Validação anti-duplicata na criação manual (mesma descrição+valor+data). Risco de falso positivo.

**Pós-pagamento**
- **PP2** — Trilha de auditoria visível (quem marcou pago, quando, IP). Dep: tabela de log.
- **PP3** — Conciliar pagamento ↔ extrato bancário (OFX). Dep: GAP estrutural OFX.

**Recibos / comunicação**
- **R1** — Enviar recibo automático por WhatsApp/email ao colaborador após marcar folha como paga. Dep: Z-API + template.
- **R2** — Botão "reenviar recibo" no card pago. Dep: R1.
- **R3** — Template editável de recibo (logo + dados Trevo). Dep: editor.
- **R4** — Histórico de envios por colaborador. Dep: R1 + tabela.
- **R5** — Confirmação de leitura (read receipt Z-API). Dep: R1.

**Bugs/menores observados na auditoria**
- **B2** — Wizard "É recorrente?" como primeira etapa do cadastro (Thales reclamou que vai/volta entre fluxos).
- **B4** — Falta export CSV mensal filtrado (já no backlog principal como P2.8). _Thales 04/05: "não uso, mas ok" → deferido._

### Backlog próximo round
- **P1.3** — Recorrentes turbinada (próximo venc, total mensal, variação %, mini-histórico).
- **P1.4** — Busca global + filtros (descrição, colaborador, valor, status).
- **P2.7** — Atalhos teclado (`/`, `n`, `p`).
- **P2.8** — Export CSV mensal.
- **GAP** — Conciliação bancária (parser OFX + fuzzy match + UI). 2-3 dias dedicados; aguardando OFX de exemplo.
- **P3 (futuro)** — Cron Supabase (pg_cron ou edge function agendada) rodando `gerarVerbasDoMes` dia 1 de cada mês. Substitui o auto-trigger client-side. Vale só quando: 2+ pessoas no financeiro ou notificação automática (WhatsApp/email) "folha gerada, X pendentes". Hoje (1 pessoa abrindo o ERP todo dia) gain é zero e risco de falha silenciosa é alto.

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
- [~] **C42** — Saldo pré-pago. **RECUADO 04/05 noite.** Aba só aparece se `isPrePago === true` — Thales nunca cadastrou pré-pago, então a feature é **invisível na UI** na prática. Remoção mexe em 11 arquivos (cadastro-rapido, ClienteDetalhe, hooks…) — não cabe em rodada "sem chance de bug". Mantém dormente até decisão explícita de refactor.
- [~] **C44** — Gerar Verbas. **REATIVADA 04/05 — NÃO REMOVER.** `gerar-verbas.ts` virou central na auto-folha (P0.3) e no CLT-salário. Botão manual em Colaboradores fica como override. Memória em `project_features_mortas.md` atualizada.
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
