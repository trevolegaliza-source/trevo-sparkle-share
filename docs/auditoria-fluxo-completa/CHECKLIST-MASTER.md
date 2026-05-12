# ✅ Checklist Master — Trevo ERP

> Consolida TUDO o que está em backlog (de todas as auditorias). Organizado por prioridade + quem executa.

**Última atualização:** 12/05/2026 manhã (pós-release Letícia/secretária)

## Convenções
- 🤖 = posso atacar sozinho (sem você fazer nada além de Publish depois)
- 📝 = preparo SQL/diff, você cola/aprova
- 🤝 = exige decisão sua (refactor grande, produto)
- 🔴 / 🟡 / 🟢 = severidade

---

## 🔥 PRIORIDADE 1 — esta semana

### Operacional (release Letícia/secretária hoje)

- [ ] **OPS-1** 🤝 — Criar conta Letícia (`gerente`) + secretária (`operacional`) via `/configuracoes`
- [ ] **OPS-2** 🤝 — Comunicar via WhatsApp + estar disponível 1h pra dúvidas
- [ ] **OPS-3** 🤖 — Acompanhar `processos_zombies` view diariamente (eu posso checar via MCP a cada sessão)

### Fixes críticos remanescentes

- [ ] **REL-019** 🤖🤝 🔴 — Criar rota `/reset-password` (link do email cai em 404). 2h. Eu implemento + você Publish. **Risco se Letícia/secretária esquecer senha hoje.**
- [ ] **INT-001** 🤖📝🤝 🔴 — Orçamento não vira processo+lancamento. Você reclamou. Caminho B (botão "Converter em processo"): ~3h, sem SQL destrutivo. **Próxima sessão dedicada.**

---

## 🚀 PRIORIDADE 2 — quick wins (1-line fixes)

### 🔄 Status após 1ª rodada de execução (12/05/2026)

- [x] **UX-018** ✅ FIXADO — routing unificado via state.tab no Dashboard
- [x] **UX-054** ✅ FIXADO — KPI "Recebido" agora navega
- [x] **UX-061** ✅ FIXADO — próximos vencimentos navegam pra cliente
- [x] **UX-062** ✅ FIXADO — mensalista sem fatura → `warning` (não `critical`)
- [x] **UX-063** ✅ FIXADO — redirect inclui cadastro_rapido + fallback humanizado
- [x] **UX-083 + UX-085** ✅ FIXADO — 4 tipos de cliente exibidos (PRE_PAGO violeta, PRECO_POR_TIPO azul)
- [x] **UX-099** ✅ FIXADO — CSV com CNPJ + código
- [x] **UX-104** ✅ FIXADO — tooltips nas 3 abas Financeiro
- [x] **UX-107** ✅ FIXADO — badge ↻ identifica recorrente
- [x] ~~**UX-017**~~ ⚠️ FALSO ALARME (já tratava multiplosProcessos)
- [x] ~~**UX-103**~~ ⚠️ FALSO ALARME (card já mostra valor)
- [x] ~~**UX-108**~~ ⚠️ FALSO ALARME (não são duplicados — exclusivos por status)
- [ ] **UX-027** ⏸️ DESIGN — tab Boleto some quando indisponível **é correto** (alternativa "Gerando..." confunde mais). Reaberto se Thales discordar.
- [ ] **UX-122** ⏸️ DESIGN — mesma decisão de UX-027

**9 fixes + 3 falsos alarmes identificados em ~1h. Build OK em todos.**

### 🔄 Status após 2ª rodada (médios, 12/05 manhã)

- [x] **UX-073** ✅ FIXADO — useClientes() com staleTime 5min (reduz queries no Cadastro Rápido)
- [x] **UX-069** ✅ FIXADO — FeedbackSucesso oferece "+1 pra este cliente" (preserva cliente)
- [x] **UX-082** ✅ FIXADO — botão ✏️ dedicado em Clientes (doppelclick mantido como atalho)
- [x] **UX-016** ✅ FIXADO — label "Pular desconto, seguir" (era "Não, obrigado")
- [x] **SEC-012** ✅ FIXADO — confirm() antes de aprovar/rejeitar usuário
- [x] **UX-014** ✅ FIXADO — dialog "Marcar Faturado" usa procs do fluxo, não state global
- [x] ~~**UX-015**~~ ⚠️ FALSO ALARME — afeta ContasReceberLista que é código órfão (nenhum import)
- [ ] **SUG-NAV-5** ⏸️ Decisão Thales — adicionar /relatorios/* ao menu vai contra "menu enxuto" (30/04)

**6 fixes + 1 falso alarme em ~50min. Build OK em todos.**

---

## 🛠️ PRIORIDADE 3 — médios (1-3h cada)

- [ ] **UX-067** 🤖🤝 🔴 (Thales reclamou) — Redundância no Step 2 Cadastro Rápido (via análise + etiqueta + prioridade)
- [ ] **UX-069** 🤖 🟡 — "+1 processo pra este cliente" no FeedbackSucesso (mantém cliente após save)
- [ ] **UX-073** 🤖 🟡 — Lentidão Cadastro Rápido (staleTime + queries paralelas)
- [ ] **UX-082** 🤖 🟡 — Edit cliente por doppelclick quebra em mobile (substituir por botão)
- [ ] **UX-014** 🤖 🔴 — Dialog "Marcar Faturado" usa state vs param (dessincronização)
- [ ] **UX-015** 🤖 🔴 — Bulk "Marcar Pagos" sem confirm/data input
- [ ] **UX-016** 🤖 🟡 — Cancel boas-vindas abre modal mesmo (label ambígua)
- [ ] **SEC-012** 🤖 🟡 — Aprovar/Rejeitar usuário sem confirm
- [ ] **UX-048** 🤖📝 🟡 — Notificar usuário após aprovação
- [ ] **UX-051** 🤖📝 🟡 — Convidar enviar magic link automático
- [ ] **SUG-NAV-5** 🤖 🟡 — Mover `/relatorios/*` pro menu (submenu Relatórios)
- [ ] **SUG-NAV-6** 🤖 🟢 — Adicionar `/documentos` ao menu Letícia
- [ ] **UX-008** 📝🤝 🟡 — Notificações com FK pra cliente (precisa migration + redeploy webhook)
- [ ] **REL-014** 📝 🔴 — `executarGeracaoExtrato` atomicidade (RPC nova)
- [ ] **UX-013** 📝 🔴 — DeferimentoModal for-loop sem rollback
- [ ] **UX-019** 📝 🔴 — "Ativar Método Trevo" 4 awaits sem atomicidade
- [ ] **REL-017** 🤖 🔴 — Race condition no register (1s wait)
- [ ] **SEC-014** ✅ (fixado ontem)
- [ ] **SEC-015** ✅ (fixado ontem)
- [ ] **SUG-DATA-002** 📝 🟢 — UPDATE 2 processos etapa `concluido` → `finalizados` (1 linha SQL)

---

## 🏗️ PRIORIDADE 4 — grandes (refactor)

- [ ] **DECISION-001 Fase 2** 🤝 🔴 — Esconder UI kanban (rota `/processos` redireciona, badges, etc). 3h. Reversível.
- [ ] **DECISION-001 Fase 3** 🤝 🔴 — Simplificar enum `etapa` pra binário (`ativo`/`finalizado`). 4h. Migração.
- [ ] **DECISION-001 Fase 4** 🤝 🔴 — Deletar arquivo Processos.tsx + dependências. 2h.
- [ ] **FEAT-004** 📝🤝 🔴 — Consolidar 3 caminhos de "marcar pago" via RPC única
- [ ] **PERF-002** 🤝 🟡 — God components (ClienteDetalhe 2549, OrcamentoNovo 1253, Catalogo 1057). Refactor médio.
- [ ] **UX-052** 🤖 🟡 — UI de permissões granulares pesada (50+ checkboxes — grupos colapsáveis)

---

## 🔐 PRIORIDADE 5 — dívida multi-tenant (futuro)

**Hoje você só tem 1 empresa — esses não pegam. Mas no dia que rolar 2ª empresa, viram bomba.**

- [ ] **PERM-008** 📝 🔴 — RLS de `cartoes/cartao_compras/cartao_faturas` permissivo
- [ ] **PERM-009** 📝 🟡 — RLS de `contatos_estado/notas_estado/precos_tiers` permissivo
- [ ] **PERM-010** 📝 🟡 — Auditar RLS detalhada de 30+ tabelas restantes (`asaas_webhook_events`, `prepago_movimentacoes`, `service_negotiations`, `despesas_recorrentes`, etc)
- [ ] **PERM-004** 🤖 🔴 — `usePermissions` falha silenciosa sem profile (logout automático)
- [ ] **SEC-017** 🤝 🟡 — Auditar `convidar-usuario` edge function (sem check de role no source?)
- [ ] **SEC-018** 🤝 🟡 — Auditar `dani-webhook-proxy` (sem JWT, potencial SSRF)
- [ ] **REL-013** ✅ (fixado ontem)

---

## 🧰 PRIORIDADE 6 — infra / observabilidade

- [ ] **C18** 🤝 🔴 — Telemetria de erros (Sentry/equivalente). Sem isso, bug em prod é silencioso.
- [ ] **C22** 🤝 🟡 — TS strict mode (~250 erros previsíveis, lote dedicado)
- [ ] **C24** 🤝 🟡 — Test coverage baseline (3-5 testes E2E pros fluxos críticos)
- [ ] **SUG-DATA-003** 📝 🟢 — DROP TABLE `backup_*_20260420` após 90d (final de julho)
- [ ] **SUG-DATA-001** 📝 🟢 — CHECK constraint `confirmado_recebimento` só em `tipo='receber'`

---

## 🍀 PRIORIDADE 7 — auditoria de contadores

- [ ] **OPS-4** 🤝 — CONTABILIDADE LJ (120774) — único contador restante. Você disse que era "caso sério". Quando bater fôlego.

---

## 📊 Resumo numérico

| Categoria | Quantidade | Posso atacar sozinho |
|---|---:|---:|
| 🚀 Quick wins (1-line) | 14 | **14** ✅ |
| 🛠️ Médios | 19 | 11 |
| 🏗️ Grandes | 6 | 0 (precisa decisão) |
| 🔐 Multi-tenant | 7 | 1 |
| 🧰 Infra | 5 | 0 |
| 📋 Total ativo | **51** | **26** |

**Posso atacar agora sem você:** **14 quick wins + ~10 médios = ~24 itens.**

---

## 🎯 Sugestão de plano pra hoje

1. **Você:** OPS-1 + OPS-2 (criar usuários, liberar)
2. **Eu:** ataco em sequência os 14 quick wins (estimo 2-3h). Cada commit isolado.
3. **Você:** quando voltar, 1 Publish sobe tudo OU revisa commit por commit.
4. **Eu:** se sobrar tempo, ataco UX-067 (redundância step 2 — você reclamou) + UX-073 (lentidão cadastro).

OK?
