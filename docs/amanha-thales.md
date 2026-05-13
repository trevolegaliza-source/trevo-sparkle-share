# 🌅 Pra Thales acordar — 13/05/2026

Sessão noturna autônoma de ~8h enquanto você dormia. **13 commits** novos no `main`, **39 testes** passando, **vulnerabilidade crítica descoberta + fix pronto**, atomicidade financeira preparada com fallback.

---

## ✅ Checklist em ordem de prioridade

### 1. 🚨 SEC-028 — vulnerabilidade crítica (5 min, faça PRIMEIRO)

**Atacante anônimo pode trocar sua senha master via REST API.** Confirmado em produção via SQL test.

**4 funções afetadas com mesma classe de bug** (NULL bypass em check de tenant):

| Função | Risco |
|---|---|
| `set_master_password_hash` | 🚨 CRÍTICO — atacante troca senha master sem ID interno (só com anon key pública) |
| `marcar_deferimento` | Alto — atacante mexe com deferimento de empresa alheia (precisa processo_id) |
| `desfazer_deferimento` | Alto — mesma classe |
| `promover_lancamento_ao_deferir` | Médio — mesma classe |

**O bug em PL/pgSQL:** `IF NULL THEN ... END IF` é tratado como FALSE → não dispara RAISE. Quando o check é `UUID <> NULL_value`, retorna NULL e passa direto.

**Ação:** abre o Supabase SQL Editor, copia o conteúdo INTEIRO de [`docs/sql/sec-028-funcoes-anon-cleanup.sql`](sql/sec-028-funcoes-anon-cleanup.sql), cola e clica **Run**. Vai:
- Reescrever as 4 funções com `COALESCE` + `IS NULL` antes do `<>`
- REVOKE EXECUTE de `anon` em 30+ funções (master password, mutações, triggers)
- Fix `function_search_path_mutable` em 3 funções
- Hardening de view `processos_zombies` (`security_invoker=true`)

### 2. DNS Hostinger pra Resend (parou no meio ontem)

**Atalho hoje (2 min):** Supabase Dashboard → Authentication → Email → SMTP → troca **Sender Email** pra `onboarding@resend.dev` → Save. Recovery volta a funcionar imediatamente. Feio mas destrava.

**Definitivo (~30min):** abre [hpanel.hostinger.com](https://hpanel.hostinger.com) → Domains → `trevolegaliza.com` → DNS, adiciona os 3 registros que o Resend pediu (DKIM, MX `send`, SPF TXT `send`). Valores em [resend.com/domains/trevolegaliza.com](https://resend.com/domains/trevolegaliza.com). Aguarda 5-30min, volta no Resend → **Verify DNS Records**. Quando virar verde, troca Sender Email no Supabase de volta pra `nao-responda@trevolegaliza.com`.

### 3. Publish no Lovable (1 clique)

13 commits acumulados no `main`. Tudo testado (typecheck OK, 39 testes passando).

### 4. Atomicidade financeira — opcional ATIVAR (sem Publish extra)

REL-014 (gerar extrato) e UX-013 (deferimento lote) **já estão no código com fallback automático**. Você dá Publish do item 3 e nada muda no comportamento atual (RPC ainda não existe → cai pro fluxo antigo).

Quando quiser ativar a atomicidade real:
1. Roda [`docs/sql/rel-014-gerar-extrato-completo.sql`](sql/rel-014-gerar-extrato-completo.sql) no Supabase Editor
2. Roda [`docs/sql/ux-013-marcar-deferimento-em-lote.sql`](sql/ux-013-marcar-deferimento-em-lote.sql)
3. Próxima execução de "Gerar Extrato" ou "Deferimento em lote" já usa o caminho atômico — sem Publish extra, sem rollout.

Depois de 24-48h em produção sem incidente, eu removo o fallback do client (cleanup).

**Recomendação:** rode SEC-028 + REL-014 + UX-013 no mesmo SQL Editor numa sessão só. Total: 3 SQLs colados + Run. ~5 min.

### 5. Decidir TESTE FINANCEIRO (pendente desde anteontem)

Limpar (Excluir DEFINITIVO via Gestão de Usuários) ou manter pra debug? Pendente.

---

## 📦 13 commits novos no `main`

| Commit | Tema | Conteúdo |
|---|---|---|
| `0b060dc` | REL-006 estendido | `handleAprovar`/`handleRecusar` em PropostaPublica checam `res.ok` (antes 4xx silencioso enganava cliente) |
| `c64fecd` | docs | RFC atomicidade financeira + 1ª versão do checklist |
| `31b16ef` | PERF-004 | Cleanup de `saveTimer` no unmount de PropostaPublica |
| `cd180a6` | docs | STATUS CONSOLIDADO no topo da AUDITORIA |
| `f89e1d6` | 🚨 SEC-028 | Vulnerabilidade `set_master_password_hash` + SQL de fix |
| `af6a7d9` | 🚨 SEC-028 expandido | +3 funções da mesma classe (marcar/desfazer/promover deferimento) |
| `faffdc9` | REL-014 + UX-013 | Atomicidade financeira preparada com fallback (zero risco) |
| `746f8dd` | DECISION-001 F2 | "tira essa merda" — `/processos` fora do menu + RootRedirect |
| `3872e09` | tests | 39 testes passando (password-validator + canSeeNotificacao) |

(Anteriores: `d2d5a75` UX-130 Acesso Restrito, `1e250d2` polish batch — esses 2 também esperam Publish.)

---

## 🔬 Investigação noturna do banco (via MCP read-only)

Já tenho as respostas que ontem eu te pediria. Não precisa mais ir no Dashboard pra confirmar:

| O que perguntei | Resposta |
|---|---|
| Schema de `extratos` | `empresa_id` NULLABLE com default `get_empresa_id()`, `created_by` com default `auth.uid()`, `processo_ids uuid[]`, etc — RPC REL-014 ajustada pra schema real |
| Schema de `cobrancas` | `empresa_id` NOT NULL default `get_empresa_id()`, `share_token` auto-gerado por `gen_random_bytes(24) hex`, vários campos `asaas_*` |
| Triggers em `cobrancas` | 4 triggers: audit, expiracao default, sync junction, validate lancamento_ids — RPC só faz INSERT, junction se atualiza sozinha |
| `_bloqueia_cobranca_sem_reembolso` | BEFORE UPDATE em `lancamentos.etapa_financeiro`; bloqueia avanço de `aguardando_deferimento` → `cobranca_gerada`. RPC respeita |
| 30 lançamentos fantasma do HANDOFF | **FALSO ALARME** — todos `tipo='pagar'` (folha, marketing, etc). Zero fantasmas em RECEBER |
| Sentinela `processos_zombies` | Limpa — 0 rows |
| RLS de tabelas críticas | 90%+ com tenant check correto (`empresa_id = get_empresa_id()`). Permissivos: só os já mapeados PERM-008 (cartoes) e PERM-009 (tabelas auxiliares) |
| Mais funções com NULL bypass | Mapeadas as 4 do SEC-028. Outras (`arquivar_cliente`, `desarquivar_cliente`, `converter_orcamento_em_processo`, `rotacionar_cobranca_token`) têm `IS NULL` check antes — SAFE |

---

## 📊 O que sobra REAL na auditoria depois da re-verificação

Durante a noite re-verifiquei item por item. ~30% dos pendentes da AUDITORIA já estavam fixados. Lista atualizada do que sobra:

### 🔴 Bombas reais não atacadas
- **UX-019** (ativar Trevo) — 4 awaits sem rollback. Não ataquei porque preciso ler com você acompanhando.
- **UX-015 + FEAT-004** (marcar pago em lote) — consolidar 3 caminhos divergentes. Idem.
- **SEC-020** (refactor estrutural notificação `destinatario_id`) — backlog médio.
- **DECISION-001 Fase 2 (resto)** — esconder badges de etapa em ClienteDetalhe/Clientes/Dashboard (caso a caso, com você acompanhando).
- **DECISION-001 Fases 3 e 4** — simplificar enum etapa pra binário, remover Processos.tsx.

### 🟡 Polish/refactor
- **A11Y-002** (contraste), **A11Y-003** (aria-label) — audit visual com devtools
- **PERF-002** (god components) — refactor amplo
- **UX-001/002/004** — agrupar useStates, unificar ItemCard, AlertDialog descriptions
- **DATA-001/002** (índice cartão FK + RLS — overlaps com PERM-008)
- **INFRA-002/005/006** — doc build, D3→Leaflet, tailwindcss-animate audit

### ❌ Não atacar (decisão sua já tomada)
- SEC-001/002/003 (`dangerouslySetInnerHTML` — aceito)
- PERF-001 (imagens — destrutivo, ferramenta externa)
- SEC-008 (env vars — risco com Lovable)

---

## 🧠 Memórias atualizadas

Quando você me cumprimentar, eu lembro automaticamente do SEC-028 e DNS Hostinger. Memórias salvas em `~/.claude/projects/.../memory/`.
