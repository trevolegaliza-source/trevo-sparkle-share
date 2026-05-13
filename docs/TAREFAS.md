# 🗂️ TAREFAS — ERP Trevo Legaliza

> **Arquivo vivo.** Centraliza pendências, melhorias, decisões, ideias.
> Atualizar a cada commit relevante. Pendentes em cima, histórico embaixo.
>
> **Legendas:** 🔴 crítico/bomba · 🟡 médio · 🟢 polish · ⏳ aguardando · ✅ feito · 🧪 testar

---

## ⏳ AÇÕES SUAS (Thales) — em aberto

### Testes pendentes do que entrou hoje
- 🧪 **Testar 1 extrato real** (REL-014 atomicidade) — gera extrato em cliente real, confere que extrato + cobrança pública nascem juntos
- 🧪 **Testar marcar pago em lote** (UX-015) — `/contas-receber` → seleciona 1-2 → "Marcar como Pagos" → confirma na janela → vê viraram pagos
- 🧪 **Testar exclusão como secretária** — pede pra ela tentar excluir um valor adicional. Deve aparecer "Tem certeza?" simples, sem campo de senha.

### Esperando externo
- ⏳ **Paulo libera SPFBL** pro servidor `.com.br` (texto enviado por WhatsApp). Quando avisar, testar `Send password recovery` pro email `thales.burger@trevolegaliza.com.br` no Supabase Users.

### Decisão tua
- ⏳ **TESTE FINANCEIRO** — limpar (Excluir DEFINITIVO via cliente) ou manter pra debug futuro?

---

## 🔴 Próximas frentes (sessão dedicada cada)

### 🟡 Refactor UX da Gestão de Usuários
**Por quê:** modal de edição confuso (queixa Thales 13/05 — "tá péssimo!!").
**Esforço:** ~3h.
**Próximas decisões/ideias:**
- Agrupar módulos por área com cabeçalhos colapsíveis (Comercial / Financeiro / Gestão / Sistema) ← já agrupa parcial
- Descrição clara de cada role (o que MUDA quando troca)
- **Preview "o que ela vai ver" antes de salvar** (lista de items do menu)
- Indicador visual de módulos críticos (financeiro, configuracoes) com aviso "atenção: dá acesso a dados sensíveis"
- Botão "voltar ao template do role" pra resetar fácil
- **Validar que Save de fato persiste** (Thales relatou que mudou role pra Operacional + desmarcou módulos no modal mas nada persistiu — provável bug no `handleEditSave` ou ele fechou sem clicar). Investigar urgente.

### 🟡 SEC-020 — refactor estrutural notificação
**Por quê:** hoje `lida` é compartilhada por empresa (se um marca lida, todos veem lida). Filtro client-side SEC-019 é cosmético, payload realtime ainda chega via WebSocket pra todos da empresa.
**Esforço:** ~2-3h.
**Plano:**
- Coluna `destinatario_id NULLABLE` em `notificacoes` (NULL = broadcast empresa, X = direto pra X)
- Tabela `notificacao_leituras (notif_id, user_id, lida_em)` pra `lida` per-user
- RLS `destinatario_id IS NULL OR destinatario_id = auth.uid()`
- Migrar 6 insert points (3 client + 3 edge functions, incl `asaas-webhook` em `.txt`)
- Realtime filter `or(destinatario_id.eq.{uid},destinatario_id.is.null)`

### 🟡 DECISION-001 Fase 3 — simplificar enum etapa pra binário
**Por quê:** Thales: *"tira essa merda"* sobre kanban operacional. Banco usa só 4 das 18 etapas. UI inteira do kanban é teatro.
**Esforço:** ~4h.
**Plano:**
- Migration: `etapa` text only aceita `'ativo'`/`'finalizado'`
- UPDATE em massa normalizando dados existentes
- RPCs atualizadas (`criar_processo_com_lancamento`, `marcar_processo_pago` etc)
- Remover `KANBAN_STAGES` do TS

### 🟡 DECISION-001 Fase 4 — remover Processos.tsx
**Esforço:** ~2h.
**Plano:**
- Deletar `Processos.tsx` inteiro
- Remover dependência `@hello-pangea/dnd` (se só era usada lá)
- Limpar relatórios filtrados por etapa específica

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

### 🟡 A11Y-002 / A11Y-003 — contraste WCAG + aria-label em buttons só com ícone
**Esforço:** ~2h, audit visual contigo.

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
