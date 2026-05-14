# 🗺️ Roadmap Trevo ERP

> **Atualizado:** 14/05/2026
> **Last review:** sessão de 14/05 fechou recurring billing + notif cliente + Hoje view.
> **Como usar:** lê esse doc primeiro pra entender estado atual antes de pedir nova feature. Cada item tem estimativa de horas + dependências + decisões pendentes.

---

## 📍 Estado atual (14/05/2026)

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
| 1 | **DSO + Top Inadimplentes** — métrica de cobrança (dias entre cobrança gerada e paga, ranking pior pagador) | ~2-3h | 06 #2 | Aguardando |
| 2 | **EmptyState/Skeleton sweep** — aplicar os componentes novos em telas que ainda têm spinners/texto genérico | ~2h | 07 Q2/Q7 | Aguardando |
| 3 | **Predição "vai bater o mês?"** — card no Dashboard com projeção × meta histórica + sugestões acionáveis | ~2h | 06 #7 | Aguardando |
| 4 | **Refactor ClienteDetalhe** — god component 2549 linhas + ClienteAccordionFinanceiro 2300 linhas | ~5h | Auditoria A.3 | **Pede sessão acompanhada** (Thales testa cada batch) |

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
