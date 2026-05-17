# 🗺️ Roadmap Trevo ERP

> **Atualizado:** 17/05/2026 (após auditoria extremamente completa — 34 achados)
> **Last review:** auditoria multi-perfil de 17/05 (5 agentes paralelos) — mapeou 30 bugs novos. Doc completo em [`docs/auditoria-2026-05-17/00-RESUMO.md`](docs/auditoria-2026-05-17/00-RESUMO.md).
> **Como usar:** lê esse doc primeiro pra entender estado atual antes de pedir nova feature. Cada item tem estimativa de horas + dependências + decisões pendentes.

---

## 🐛 Bugs em aberto (auditoria 17/05/2026)

**Resumo:** 34 achados — 7 🔴 críticos, 20 🟡 médios, 7 🟢 polish. Lista completa em [`docs/auditoria-2026-05-17/00-RESUMO.md`](docs/auditoria-2026-05-17/00-RESUMO.md).

### 🔴 Críticos

| ID | Bug | Arquivo | Status |
|---|---|---|---|
| ~~SEC-029~~ | ✅ Valores R$ vazam em `/clientes` — fix aplicado (Dashboard era falso alarme) | `Clientes.tsx` | ✅ commit 17/05 |
| ~~PERM-012/014~~ | ✅ Botões Editar/Arquivar sem check de permissão — fix aplicado | `Clientes.tsx` | ✅ commit 17/05 |
| ~~UX-140/143~~ | ✅ Validação itens em handleSave + bloqueio copyLink em rascunho | `OrcamentoNovo.tsx` | ✅ commit 17/05 |
| ~~FIN-002~~ | ✅ `gerar_extrato_completo` rejeita array vazio + 0 atualizados | `fin-002-*.sql` | ✅ commit 17/05 (aguarda rodar SQL) |
| FIN-001 | Race no webhook Asaas — `handlePaidEvent` não libera `asaas_gerando_lock_ate` | `asaas-webhook/index.txt:180-229` | Refactor handler (~1h, sessão acompanhada) |
| CODE-002 | Race em 2 `useEffect[cliente]` no ClienteAccordionFinanceiro — trocar cliente rápido mistura state | `ClienteAccordionFinanceiro.tsx:1322-1391` | Validar cliente_id no init (~30min) |
| CODE-005 | Modal GestaoUsuarios persiste state ao navegar — volta com dado antigo | `GestaoUsuarios.tsx:88-100` | Cleanup ao unmount (~20min) |
| CODE-009 | Delete cliente checa só frontend — RLS pode permitir DELETE via DevTools | `ClienteDetalhe.tsx:71-72,1340` | RLS policy SQL (~1h, acompanhada) |

### 🟡 Médios (20 itens — ver doc completo)

3 SEC + 2 PERM + 5 FIN + 6 UX + 4 CODE. Detalhe e fix em [`docs/auditoria-2026-05-17/00-RESUMO.md#-20-medios`](docs/auditoria-2026-05-17/00-RESUMO.md).

### 🟢 Polish (7 itens)

FIN-006, FIN-008, UX-146, UX-148, CODE-004, CODE-007, CODE-010.

### 🟡 Bug-006 (carry-over)

| 006 | **Duplicação de lançamentos** — ADVANCE BPM 220352 teve 12 lançamentos órfãos criados em 3 batches (15/05/2026 21:20–21:52) com etapa `solicitacao_criada` sem cobrança vinculada. NÃO veio do `gerar_extrato_completo` (que só faz UPDATE). Suspeito: front criando INSERT em paralelo ou retry mal-rollback. Cleanup ad-hoc feito. **Investigar se reaparecer em outro cliente.** Possível causa raiz mapeada agora em **CODE-002** (race useEffect) — fix de CODE-002 pode fechar este bug também. | Médio | Triage query no `project_estado_17_05.md` |

---

## 📍 Estado atual (17/05/2026)

**Fluxos completos end-to-end:**
- ✅ Cadastro Cliente + Processos + Financeiro (multi-tenant via empresa_id)
- ✅ Orçamento criar → enviar link público → cliente aprova → cobrança Asaas gerada → cliente paga → orçamento vira "convertido" automaticamente (trigger sync)
- ✅ Recurring billing mensalistas D-5 (pg_cron diário)
- ✅ Email automático em eventos chave: deferimento, cobrança gerada, pagamento confirmado (requer Resend configurado)
- ✅ MRR Dashboard + Hoje view + Financeiro com KPIs Linear-feel

**Identidade visual:**
- Plus Jakarta Sans (font)
- Verde Trevo (#16a34a) accent com acent bar lateral 3px em cards
- Dark mode primário
- 5 componentes UI novos: `KPICard`, `AttentionCard`, `EmptyState`, `PageHeader`, `SkeletonPatterns`

**Stack:**
- React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + RLS + Realtime + Edge Functions + pg_cron + pg_net)
- Asaas (cobranças PIX/boleto via webhook)
- Resend (email transacional — *requer setup*)

---

## 🔥 Queue ativa (prioridade alta — atacável próximas sessões)

| # | Frente | Estimativa | Doc | Status |
|---|---|---|---|---|
| 1 | **PDF Detalhado v2** — versão visual rica do PDF (capa + cenários + cards de serviços com prazo/docs). V1 removida 14/05 (Thales: "estava horrível"). Sistema usa template simples até v2. | ~4-6h | — | **Pede ideação de layout** (Thales referência) |
| 2 | **DSO + Top Inadimplentes** — métrica de cobrança (dias entre cobrança gerada e paga, ranking pior pagador) | ~2-3h | 06 #2 | Aguardando |
| 3 | **EmptyState/Skeleton sweep** — aplicar os componentes novos em telas que ainda têm spinners/texto genérico | ~2h | 07 Q2/Q7 | Aguardando |
| 4 | **Predição "vai bater o mês?"** — card no Dashboard com projeção × meta histórica + sugestões acionáveis | ~2h | 06 #7 | Aguardando |
| 5 | **Refactor ClienteDetalhe** — god component 2549 linhas + ClienteAccordionFinanceiro 2300 linhas | ~5h | Auditoria A.3 | **Pede sessão acompanhada** (Thales testa cada batch) |

---

## 🟡 Backlog médio prazo

| # | Frente | Estimativa | Doc | Notas |
|---|---|---|---|---|
| 5 | **Lembretes Dani WhatsApp inteligentes** — D-3 / D-0 / D+3 pra cobrar | ~3h | 06 #4 | **Bloqueado:** Thales sem API Meta oficial ainda |
| 6 | **Template de processos** — criar templates reutilizáveis (ex.: "Abertura LTDA São Paulo") | ~2-3h | 06 #8 | Aguardando decisão: só master cria ou qualquer perfil? |
| 7 | **Import OFX** — importar extrato bancário pra conciliar pagamentos | ~3-4h | 06 #9 | Aguardando decisão: bancos prioritários (Inter? Itaú?) |
| 8 | **App mobile PWA + push** | ~4-6h | 06 #10 | Vem depois das features de gestor |

---

## 🎨 Visual polish — Refactors amplos (R-tier, doc 07)

| # | Frente | Estimativa | Notas |
|---|---|---|---|
| R1 | **Design System doc + Storybook** | ~6h | Documenta os 5 componentes novos + tokens visualmente |
| R2 | **PropostaPublica + CobrancaPublica migrar pra Tailwind** | ~5h | Hoje usam CSS inline `buildStyles()` — 2 sistemas coexistem |
| R3 | **Refactor visual Dashboard completo** | ~3h | ✅ feito 14/05 (commit 7279ef9) |
| R4 | **ClienteDetalhe visual rebuild** | ~6h | Conjunto com refactor #4 acima |
| R5 | **/orcamentos lista visual rebuild** | ~3h | Cards mais espaço, filtros laterais, drag-to-reorder? |

---

## ❓ Decisões pendentes (Thales precisa responder antes)

### Setup
- [ ] **Resend** — criar conta + verificar domínio trevolegaliza.com.br + setar `RESEND_API_KEY`. Sem isso emails de recurring billing e notif-cliente-eventos não enviam (sistema funciona, só não notifica via email).
- [ ] **WhatsApp API Meta** — quando sair, habilita Lembretes Dani + Notif WhatsApp pro cliente.

### Produto
- [ ] **Template de processos:** quem cria? Master only ou qualquer perfil?
- [ ] **Import OFX:** quais bancos priorizar?
- [ ] **Cor primária:** verde Trevo está bom (decidido 14/05 ✅)
- [ ] **Tipografia:** Plus Jakarta Sans (decidido 14/05 ✅)
- [ ] **Estilo:** Linear-like minimalista (decidido 14/05 ✅)
- [ ] **Dani no ERP interno:** aparecer em header? empty states? mascote?

---

## 📊 Sessões grandes recentes

| Data | Foco | Commits |
|---|---|---|
| 17/05/2026 | Hotfixes produção: FK CASCADE delete processo + comprovante taxa_balcao opcional + cleanup 12 duplicatas ADVANCE BPM | 2 commits + 1 SQL ad-hoc |
| 14/05/2026 (noite) | Recurring billing + Notif cliente eventos + Hoje view | 8 commits |
| 14/05/2026 (tarde) | Visual Plus Jakarta + Linear + PDF redesign | 5 commits |
| 14/05/2026 (manhã) | Fix Asaas público + 6 bugs orçamento convertido | 4 commits |
| 13/05/2026 (noite) | Mapa mental 6700+ linhas + features gestor + auditoria visual | 4 commits (autônoma 10h) |
| 13/05/2026 (dia) | Sprint 2.A.4 — fluxo cliente aprova → Asaas direto | 3 commits |
| 12/05/2026 | DECISION-001 Fase 3 — etapa binária | 5 commits |

---

## 🧠 Onde está cada coisa

- **Auditoria página-por-página:** [`docs/auditoria-2026-05/`](docs/auditoria-2026-05/) — 8 docs do perfil master
- **Mapa mental clique-a-clique:** [`docs/mapa-mental/`](docs/mapa-mental/) — 7 docs (01-cliente, 02-orcamento, 03-pagar, 04-financeiro, 05-config, 06-features-gestor, 07-auditoria-visual)
- **SQL migrations:** [`docs/sql/`](docs/sql/) — todos os SQLs aplicados em produção
- **Edge functions:** `edge-functions-deploy/supabase/functions/`

---

## 🎯 Mensagem final

Esse roadmap é **vivo** — atualizar quando:
- Atacar uma frente da queue → mover pra "Sessões grandes recentes" e marcar ✅
- Descobrir frente nova → adicionar em "Queue ativa" ou "Backlog"
- Decisão tomada → tirar de "Decisões pendentes"
- Bug crítico aparecer → criar seção "Bugs em aberto" no topo
