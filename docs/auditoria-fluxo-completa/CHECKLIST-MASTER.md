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

**Posso atacar agora todos esses, sem SQL, commit isolado por item:**

- [ ] **UX-017** 🤖 🟡 — Mensagem Dani na CobrancaPublica usa `lancamentos[0].tipo` (em multi-processo cita só 1)
- [ ] **UX-018** 🤖 🟡 — Routing Dashboard misturando state e querystring (uniformizar)
- [ ] **UX-054** 🤖 🟡 — KPI "Recebido" no Dashboard sem onClick
- [ ] **UX-061** 🤖 🟢 — "Próximos vencimentos" sem onClick por linha
- [ ] **UX-062** 🤖 🟢 — Mensalista sem fatura como `critical` (deveria `warning`)
- [ ] **UX-063** 🤖 🟡 — Fallback "Aguarde administrador" desanima operacional (substituir por atalhos)
- [ ] **UX-083 + UX-085** 🤖 🟡 — Tipo cliente em Clientes (lista) só mostra 2 de 4 valores (PRE_PAGO/PRECO_POR_TIPO viram "Avulso")
- [ ] **UX-099** 🤖 🟢 — Export CSV de Processos sem dados do cliente
- [ ] **UX-103** 🤖 🟢 — Card kanban sem valor R$
- [ ] **UX-104** 🤖 🟢 — Abas Financeiro opacas sem tooltip
- [ ] **UX-107** 🤖 🟢 — Sem badge ↻ em conta recorrente
- [ ] **UX-108** 🤖 🟢 — 2 botões "Marcar pago" duplicados em ContasPagarLista (mesma função)
- [ ] **UX-122** 🤖 🟢 — Portfólio: tab Boleto some sem aviso (estado "Gerando...")
- [ ] **UX-027** 🤖 🟢 — Tab Boleto na Cobrança Pública same problema

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
