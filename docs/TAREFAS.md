# 🗂️ TAREFAS — ERP Trevo Legaliza

> **Arquivo vivo.** Centraliza pendências, melhorias, decisões, ideias.
> Atualizar a cada commit relevante. Pendentes em cima, histórico embaixo.
>
> **Legendas:** 🔴 crítico/bomba · 🟡 médio · 🟢 polish · ⏳ aguardando · ✅ feito · 🧪 testar

---

## ⏳ AÇÕES SUAS (Thales) — em aberto

### Rodar SQL + deploy (SEC-020 — nova entrega de hoje à tarde)
- 🟢 **Rodar** [`docs/sql/sec-020-notificacoes-destinatario.sql`](sql/sec-020-notificacoes-destinatario.sql) no Supabase SQL Editor
- 🟢 **Deploy** `supabase functions deploy registrar-login --project-ref aahhauquuicvtwtrxyan`
- 🟢 **Publish no Lovable** (sobe refactor UX Gestão de Usuários + canSeeNotificacao com destinatario_id)

### Testes pendentes do que entrou hoje
- 🧪 **Testar 1 extrato real** (REL-014 atomicidade) — gera extrato em cliente real, confere que extrato + cobrança pública nascem juntos
- 🧪 **Testar marcar pago em lote** (UX-015) — `/contas-receber` → seleciona 1-2 → "Marcar como Pagos" → confirma na janela → vê viraram pagos
- 🧪 **Testar exclusão como secretária** — pede pra ela tentar excluir um valor adicional. Deve aparecer "Tem certeza?" simples, sem campo de senha.
- 🧪 **Testar refactor UX Gestão de Usuários** — abre edição da secretária, mexe em algo, tenta fechar sem salvar. Deve aparecer aviso "ALTERAÇÕES NÃO SALVAS" + confirmação ao fechar.

### Esperando externo
- ⏳ **Paulo libera SPFBL** pro servidor `.com.br` (texto enviado por WhatsApp). Quando avisar, testar `Send password recovery` pro email `thales.burger@trevolegaliza.com.br` no Supabase Users.

### Decisão tua
- ⏳ **TESTE FINANCEIRO** — limpar (Excluir DEFINITIVO via cliente) ou manter pra debug futuro?

---

## 🔴 Próximas frentes (sessão dedicada cada)

### ✅ Refactor UX da Gestão de Usuários — entregue 13/05 tarde
- **Dirty state**: badge "ALTERAÇÕES NÃO SALVAS" no header quando há mudança
- **Confirm ao fechar sujo**: Cancelar/Esc/click-fora pede confirmação se há mudanças não salvas
- **Save button condicional**: "Salvar alterações" (highlighted) vs "Sem alterações" (disabled)
- **Preview do menu lateral**: mostra exatamente o que o user vai ver baseado nas permissões atuais
- **Badge SENSÍVEL**: módulos críticos (financeiro, contas_pagar, configuracoes, colaboradores, relatorios_dre, fluxo_caixa) ganham badge vermelho de aviso

Investigação do bug "não persiste": provavelmente o Thales fechou o modal sem clicar Salvar (botão estava menos destacado). Agora o badge "ALTERAÇÕES NÃO SALVAS" + confirm-on-close evita o problema.

### ✅ SEC-020 — destinatario_id em notificações — entregue 13/05 tarde (essencial)
- Coluna `destinatario_id NULLABLE` em `notificacoes` (NULL = broadcast empresa, X = direto pra X)
- RLS apertada: `empresa_id = get_empresa_id() AND (destinatario_id IS NULL OR destinatario_id = auth.uid())`
- Função `get_empresa_master_id(p_empresa_id uuid)` pra inserts setarem destinatário
- `canSeeNotificacao` client respeita `destinatario_id` quando setado
- Edge function `registrar-login` passa a setar destinatario = master da empresa em notifs de login_novo

**Pendente da SEC-020 (não-essencial):**
- Tabela `notificacao_leituras (notif_id, user_id, lida_em)` pra `lida` per-user (hoje continua compartilhada por empresa)
- Migrar inserts `convidar-usuario`, `criar-usuario-com-senha`, `asaas-webhook` (.txt zumbi) pra setar destinatario_id
- Realtime filter passar a usar `or(destinatario_id.is.null,destinatario_id.eq.{userId})` — Supabase Realtime não suporta `or()` filter; alternativa = continuar empresa_id no servidor + canSeeNotificacao no client (atual)

### 🟡 DECISION-001 Fase 2 (resto) — esconder badges de etapa
**Status:** ✅ FEITO em 13/05 tarde. Helper `getEtapaSimplificada` em `types/process.ts` mapeia as 18 etapas pra Ativo/Finalizado. Aplicado em 3 lugares de ClienteDetalhe (aguardando deferimento, lista de processos, sidebar). UI agora mostra só "Ativo"/"Finalizado". Banco intacto.

### ✅ DECISION-001 Fase 3 + Fase 4 antecipada — entregue 13/05/2026 noite
- Banco: SQL `docs/sql/decision-001-fase3-enum-etapa.sql` (UPDATE dados + CHECK + DROP trigger + 5 RPCs + view + backfill data_deferimento)
- Frontend: `types/process.ts` com helpers tolerantes (`getEtapaSimplificada`, `isProcessoFinalizado`); 10+ queries Supabase atualizadas
- Fase 4 antecipada: `Processos.tsx` deletada, `/processos → /processos-ativos`, dep `@hello-pangea/dnd` removida
- Gráfico "Pipeline" do Dashboard removido (5 fatias → sem sentido com binário)
- `relatorio-status-pdf.ts` reescrito (badge simples, sem progress bar 17-etapas)
- 2 escritas diretas de etapa eliminadas (`ClientesAuditoria` agora usa RPC `marcar_deferimento`; `Documentos` não rebaixa no reject)

**Pendente Thales:**
- ⏳ **Publish no Lovable** (sobe frontend tolerante)
- ⏳ **Rodar SQL** `docs/sql/decision-001-fase3-enum-etapa.sql` no SQL Editor
- 🧪 Smoke test: criar processo, marcar deferido, gerar extrato, marcar pago, desfazer pago

### 🔵 Auditoria exaustiva página por página, clique por clique
**Por quê:** Thales pediu *"faça uma análise de absolutamente tudo, página por página, clique por clique e afins"*.
**Status atual:** parcial em `docs/auditoria-fluxo-completa/` (17 telas + 5 anexos, feita em 11/05). Mas não é "clique por clique" — é mais de fluxo.
**Esforço:** **alto** — depende do escopo. Estimativas:
- "Verificação de cada botão e estado de tela": ~15-20h em sessão acompanhada
- "Apenas mapeamento crítico do que falta de coverage": ~3-4h
**Decisões pendentes:**
- Escopo: cada tela do menu? Cada subseção? Inclui modais? Inclui propostas públicas?
- Formato: doc por tela, ou batch num arquivo grande?
- Profundidade: só "o que acontece quando clico?" ou "o que acontece em cada estado de erro?"
- Cobertura: master + gerente + operacional + visualizador (4 perfis), ou só master?

### 🟡 A11Y-002 — contraste WCAG
**Esforço:** ~1h audit visual contigo (devtools color contrast checker).

### ✅ A11Y-003 — aria-label em buttons só com ícone (entregue 13/05 noite)
Sweep completo após Fase 3: 35 buttons em 15 arquivos receberam `aria-label` apropriado.
- AppLayout (Menu, Search mobile), ContasReceberLista (Marcar pago, Cobrar)
- GerarVerbasModal (nav mês), ConfirmarDiasUteisModal (+/-), ContasPagarLista (comprovante)
- HonorariosInlineRepeater (Excluir), ServicosPreAcordados (Editar/Excluir), PlanoContasTab (Adicionar/Editar)
- CategoriaAccordion × 3 (Marcar pago/Editar nos 3 accordions), RecorrentesTab (Editar/Toggle/Excluir)
- FinanceiroList (Mais ações), ClienteDetalhe (Voltar), Clientes (Baixar/Excluir contrato)
- FaturamentoDetalhe, ProcessosAtivosDetalhe (Voltar), OrcamentoNovo (Voltar + 4 botões Trash2)

Leitor de tela agora anuncia ação ao invés de "botão".

### 🟡 UX-001 / UX-002 / PERF-002 — god components
**Por quê:** ClienteDetalhe (2549 linhas, 59 useState), ClienteAccordionFinanceiro (2302), OrcamentoNovo (1253), PropostaPublica (1142). 4 god components > 1000 linhas.
**Esforço:** **alto** (~5-8h por componente). Refactor amplo.

---

## 🟢 Polish menores ainda em backlog

| ID | O que |
|---|---|
| UX-004 | AlertDialogs sem descrição clara (varredura global) |
| UX-023 | Cliente PRÉ-PAGO sem histórico visível de movimentações |
| INFRA-002 | Documentar `build` vs `build:dev` no README |
| INFRA-005 | Avaliar D3 → Leaflet (60KB → 14KB) |
| INFRA-006 | Auditar `tailwindcss-animate` keyframes |

---

## ❌ Decidido NÃO atacar (decisão Thales)

- **SEC-001/002/003** (`dangerouslySetInnerHTML` com GLASS_CSS estático — risco XSS = zero)
- **PERF-001** (otimização de imagens — destrutivo, requer ferramenta externa)
- **SEC-008** (env vars hardcoded — risco com Lovable)

---

## 📚 HISTÓRICO — feito em sessões anteriores

### 13/05/2026 (noite)
- ✅ **DECISION-001 Fase 3 + Fase 4 antecipada**: etapa binária no banco + Processos.tsx deletada (vide acima)
- ✅ **A11Y-003 sweep completo**: 35 buttons icon-only ganharam aria-label (vide acima)

### 13/05/2026 (manhã + tarde)
- 🚨 **SEC-028 (CRÍTICO)**: vulnerabilidade NULL bypass em 4 funções (`set_master_password_hash`, `marcar_deferimento`, `desfazer_deferimento`, `promover_lancamento_ao_deferir`) + REVOKE EXECUTE de anon em 30+ funções
- ✅ **Bloco B — atomicidade financeira completa** (5/5 fluxos com fallback):
  - REL-014 (gerar extrato completo)
  - UX-013 (deferimento em lote)
  - UX-019 (Método Trevo)
  - UX-015 + FEAT-004 (marcar pago em lote + desfazer com tenant check)
- ✅ **DATA-001 + DATA-002 / PERM-008**: cartões/cartao_compras/cartao_faturas multi-tenant + índices FK
- ✅ **DNS Hostinger + Resend verified**: domínio `trevolegaliza.com` enviando emails legítimos
- 🐛 **Fix sidebar secretária**: permissões mal cadastradas + Cadastro Rápido com módulo errado (`processos` → `cadastro_rapido`)
- ✅ **Excluir sem senha master pra não-master**: `PasswordConfirmDialog.bypassMasterPassword` — operacional/gerente excluem com simple confirm
- ✅ **39 testes automatizados** (password-validator + canSeeNotificacao)
- ✅ User de teste `trevolegaliza@gmail.com` apagado

### 12/05/2026
- 🔐 4 ondas de segurança: SEC-019 a SEC-027 (TOTP obrigatório pra todos, timeout role-aware, botão Resetar 2FA, recovery codes, alerta login novo, senha atual no trocar senha, validação de força em todos os pontos)
- 🐛 UX-130: bug "Acesso Restrito" no login de gerente/operacional (RootRedirect)
- 🎨 Polish: REL-015, UX-024, UX-026, UX-027
- 📄 RFC atomicidade financeira

### 11/05/2026
- Release Letícia + secretária
- 13 fixes iniciais (DATA-005/006/007, REL-009/012/013, UX-007/009/010/011/020, MON-001, FEAT-001/002/003)
- Auditoria de fluxo completa em `docs/auditoria-fluxo-completa/` (17 telas + 5 anexos + ~120 achados)

### Sessões anteriores
- Auditoria sistêmica (07/05) — Sprints 1-5
- Auditoria `/cobranca/:token` (07/05)
- Hotfix migração Supabase (05/05)
- Cleanup do kanban zumbi SEPI/ASLAN
- Vide AUDITORIA-GROTESCA-TREVO-ERP.md pra histórico completo

---

## 📎 Arquivos importantes pra consultar

- **`AUDITORIA-GROTESCA-TREVO-ERP.md`** (raiz) — backlog vivo de itens auditados, com IDs (SEC-*, REL-*, UX-*, etc)
- **`docs/rfc/atomicidade-financeira.md`** — RFC original (parte dela já implementada no Bloco B)
- **`docs/auditoria-fluxo-completa/`** — 17 telas + 5 anexos, audit de fluxo (11/05)
- **`docs/sql/*.sql`** — todos os SQLs já rodados em produção (REL-014, UX-013, UX-019, UX-015+FEAT-004, DATA-001/002, SEC-024, SEC-025, SEC-028)
- **`HANDOFF.md`** (raiz do `Trevo-ERP-ATIVO/`) — constituição do chat: usuário, regras, restrições

---

## 🧠 Como manter este arquivo vivo

- IA atualiza ao final de cada sessão relevante
- Pendentes (tua decisão / tua ação / aguardando externo) ficam no topo
- Backlog de frentes vem depois
- Histórico no fim (cronológico inverso, mais recente em cima)
- Marca status com emoji legível
