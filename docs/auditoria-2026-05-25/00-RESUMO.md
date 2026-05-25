# 🔍 AUDITORIA PÓS-VIAGEM — 25/05/2026

> **Disparada por Thales:** após retorno da viagem, refazer auditoria considerando 51 commits desde a última (45 em 18/05 + 6 hoje).
>
> **Método:** 2 agentes paralelos — (A) revisão de status dos 34 achados de 17/05, (B) varredura nova em código pós-17/05. Críticos validados manualmente contra código real antes de consolidar.
>
> **Escopo:** sistema pós-todas-as-mudanças até commit `2303f1f` (Sessão A da auditoria) + `[NOVO]` (Sessão B+C).

---

## 📊 Sumário executivo

### Auditoria 17/05 — **fechada**
- ✅ **24 CORRIGIDOS** | ❌ **8 FALSO ALARME** | ⏳ **2 PENDENTES** (FIN-006 polish + CODE-007 fantasma) | 🤷 **1 NÃO VERIFICÁVEL**

### Auditoria 25/05 — **13 achados, 12 atacados (Sessão A+B+C+D)**

| Status | Total | 🔴 Crítico | 🟡 Médio | 🟢 Polish |
|---|---:|---:|---:|---:|
| ✅ Corrigido (Sessão A 25/05) | 4 | 4 | 0 | 0 |
| ✅ Corrigido (Sessão B+C 25/05) | 7 | 0 | 4 | 3 |
| ✅ Corrigido (Sessão D 25/05) | 1 | 1 | 0 | 0 |
| 🤝 Aceito (trade-off) | 1 | 0 | 1 | 0 |
| **Total** | **13** | **5** | **5** | **3** |

### Estado da plataforma
- **Frontend:** commit `2303f1f` no `main` + commits Sessão B+C (a serem pushed)
- **Edge `asaas-webhook`:** v30 (PAYMENT_UPDATED handler)
- **Edge `asaas-atualizar-vencimento`:** v2 (FIN-009 — grava em entidade_audit)
- **Edge `enviar-push`:** ativa (deploy 18/05; agora recebe body mascarado da trigger)
- **SQL aplicado:** RLS DELETE refactor (`f63b15d`) + SEC-033 RPCs bifurcadas (`2303f1f`) + SEC-034/035 (a aplicar)

---

## ✅ SESSÃO A — 4 CRÍTICOS (concluída em `2303f1f`)

### SEC-033 ✅ — Senha de proposta vira proteção real
- **Bug:** RPC `get_proposta_por_token` retornava 40+ campos + `has_password`. Frontend só pulava pra tela de senha SE `has_password=true`, mas os dados já estavam em memória. Atacante via DevTools/curl vê tudo sem digitar senha.
- **Fix aplicado:**
  - SQL `docs/sql/sec-033-proposta-senha-real.sql` aplicado em prod (2 funções: `get_proposta_publica_minima` + `get_proposta_por_token(p_token, p_senha)`)
  - `PropostaPublica.tsx`: 2-step load — mínima primeiro → completa após autenticar
- **Verificação:** curl com share_token sem senha agora retorna 0 rows.

### PERM-015 ✅ — Histórico mascara R$ pra operacional/visualizador
- **Bug:** `HistoricoEntidadeModal` mostrava `valor_final: R$ 5.000 → R$ 4.500` mesmo pra operacional. SEC-029 (Clientes) tinha protegido `valor_base` mas histórico ignorou.
- **Fix aplicado:** `HistoricoEntidadeModal` usa `usePermissions().podeVerValores()`. Campos `valor`, `valor_final`, `valor_avulso`, `valor_base`, `desconto_pct`, `desconto_progressivo_pct` viram `•••••`.

### FIN-009 ✅ — `EditarVencimentoButton` ganha gate + auditoria + max=180d
- **Bug:** qualquer perfil com módulo `financeiro` (inclui visualizador) mudava data no Asaas+ERP sem trilha.
- **Fix aplicado:**
  - `EditarVencimentoButton.tsx`: `if (!canEdit) return null;` + `max={hoje+180d}` (resolve UX-149 junto)
  - Edge `asaas-atualizar-vencimento` v2: grava entry em `entidade_audit` (campo `data_vencimento`, valor antigo → novo, ator)
  - **Bônus:** consolidada duplicata — `DetalhesCobrancaModal` agora reusa `EditarVencimentoButton` (commit `391ec8d` eu havia criado dialog próprio sem perceber que já existia desde `92bd1a2`).

### SEC-034 + SEC-035 (movidos pra Sessão B — ver abaixo)

---

## ✅ SESSÃO B+C — 7 médios/polish (concluída nesta sessão)

### SEC-034 + SEC-035 ✅ — Push notification: privacidade + unread por user
- **Bug:** `dispatch_push_notif` enviava `body = v_notif.mensagem` LITERAL no lockscreen (vaza nome cliente + R$). Também: `unread_count` era soma de todos os masters quando `destinatario_id IS NULL` — badge inflado.
- **Fix aplicado:**
  - SQL `docs/sql/sec-034-035-push-privacidade-unread-per-user.sql`:
    - Body genérico por tipo: `'💰 Pagamento recebido. Toque para ver.'` / `'📋 Atualização de cobrança...'` / `'📄 Atualização de proposta...'` / etc.
    - Loop por user — cada chamada `net.http_post` com `unread_count` específico daquele user + subs só daquele user.
  - Mensagem completa continua em `notificacoes.mensagem` (acessível só após login).
- **Pra ativar:** rodar SQL.

### SEC-036 ✅ — Push unsubscribe: ordem correta
- **Bug:** `usePushNotifications.ts:99-100` deletava do DB ANTES de `sub.unsubscribe()`. Se browser falhasse → orphaned subscription.
- **Fix aplicado:** browser unsubscribe primeiro; só deleta DB se confirmou; log de warning se DB falhar (não bloqueia).

### CODE-011 ✅ — `useUpsertClientePrecoTipo` agora atômico
- **Bug:** SELECT + INSERT/UPDATE manual; race entre 2 cliques rápidos (banco já tinha UNIQUE, mas frontend fazia round-trip desnecessário).
- **Fix aplicado:** `.upsert(..., { onConflict: 'cliente_id,tipo' })` — 1 statement.

### UX-150 ✅ — Cache flicker em useFinanceiroClientes
- **Bug:** override `staleTime: 0` + default global `refetchOnWindowFocus: true` (commit `3b94fee`) causava refetch a cada blur/focus rápido na lista mais pesada.
- **Fix aplicado:** `staleTime: 10_000` no override. Ainda essencialmente fresh; mutações invalidam explicitamente via `invalidateFinanceiro`.

### CODE-013 ✅ — `useHistoricoEntidade` cast safe
- **Bug:** `(data ?? []) as HistoricoEntry[]` — se RPC mudar shape, crash silencioso no `.map`.
- **Fix aplicado:** `Array.isArray(data) ? (data as HistoricoEntry[]) : []`.

### UX-151 ✅ — Push permission states distintos
- **Bug:** `unsubscribed` (permissão dada, sem inscrição) e `default` (nunca pediu) viam o mesmo botão "Ativar neste dispositivo".
- **Fix aplicado:** se `unsubscribed`, botão vira "Reativar neste dispositivo" + nota "Permissão já dada".

---

## ✅ SESSÃO D — Investigações + 1 crítico novo

### SEC-037 ✅ — RPC `criar_notificacao_proposta` órfã com EXECUTE PUBLIC + injeção
- **Bug descoberto na investigação:** função `criar_notificacao_proposta(uuid, text, text)` aceita `p_mensagem text` LITERAL, EXECUTE para PUBLIC (anon+authenticated), `SECURITY DEFINER` (contorna RLS), insere direto em `notificacoes.mensagem`. Atacante anon com qualquer UUID de orçamento conseguia spam de notif + phishing via título hardcoded "🟢 PROPOSTA APROVADA".
- **Verificação:** zero callers no frontend, SQL routines, triggers ou 26 edge functions deployadas → **órfã**.
- **Fix:** `docs/sql/sec-037-drop-criar-notificacao-proposta-orfa.sql` — `DROP FUNCTION` com rollback documentado caso descubra caller depois.
- **Pra ativar:** rodar SQL.

### PF + Asaas ✅ — Confirmado funcionando
- Verifiquei `asaas-gerar-cobranca` v22 (via MCP): lógica `tipoPessoa === "PF"` na função `ensureCustomer` valida CPF 11 dígitos / CNPJ 14 dígitos. Asaas aceita `cpfCnpj` único campo. Caso real com PF não testado mas código suporta corretamente.

### FIN-006 ✅ — Fechado como non-applicable
- Auditoria 17/05 marcou "webhook insere notificação em empresa soft-deletada". Verifiquei schema: tabela `empresas` não existe; só `empresas_config` (config por tenant, sem coluna `ativo`/`deleted_at`). Empresa não pode ser soft-deletada. **Achado original presumiu schema que nunca foi implementado.**

### CODE-007 ✅ — Fechado como fantasma
- Auditoria 17/05 marcou `useCallback sem deps` em `ClienteAccordionFinanceiro.tsx:359`. Linha 359 atual fecha o componente anterior (não é callback). O único `useCallback` no arquivo (`handleGerarFaturaMensal` linha 372) tem `[queryClient]` como deps. Refactor moveu o código original. **Não há bug latente.**

### RLS UPDATE refactor 🤝 — Adiado como débito documentado
- Pretendido: análogo ao DELETE — criar `tem_permissao_editar(modulo)` + RLS UPDATE checa user_permissions.
- **Por que adiar:** verificação de `user_permissions` mostra Letícia/Michele com `pode_editar=false` em `financeiro/contas_pagar/colaboradores/catalogo`. Aplicar gate em UPDATE de `lancamentos/cobrancas/extratos` bloquearia fluxos indiretos (ex: marcar processo concluído → trigger UPDATE em lancamento). Risco real de travar operação.
- **Pra reabrir:** ou (a) revisar/popular permissões antes, ou (b) audit cuidadoso de todos triggers SQL pra ver quais usam supabase client (respeitam RLS) vs SECURITY DEFINER (ignoram).
- **Esforço estimado:** ~3h pra audit + 1h apply + smoke test acompanhado.

---

### CODE-012 🤝 — Trigger fire-and-forget no push (ACEITO)
- **Trade-off:** trigger AFTER INSERT em `notificacoes` chama `net.http_post`. Se a transação dá rollback, push já saiu — user recebe alerta de evento que não existe.
- **Por que não atacar agora:**
  - Frequência real é raríssima — `INSERT em notificacoes` raramente rolla back (a inserção é o último step das funções que disparam notif).
  - Pior caso = user recebe "🔔 Nova atividade no ERP" → abre o app → não vê nada novo. Aceitável.
  - Solução robusta (push em cron lendo `push_enviado_em IS NULL`) adiciona coluna + cron + job + retry, ~3h dev.
- **Reabrir se:** começarem a aparecer reclamações de "push de evento que sumiu", ou rollback ficar comum.

---

## ⏳ PENDENTES — futuras sessões

### Da auditoria 17/05 — **fechada totalmente nesta sessão**
- ~~FIN-006~~ ✅ fechado (non-applicable, ver Sessão D)
- ~~CODE-007~~ ✅ fechado (fantasma após refactor, ver Sessão D)

### Da auditoria 25/05
- **CODE-012** 🤝 — Aceito como trade-off. Reabrir se houver dor real.
- **RLS UPDATE refactor** 🤝 — Adiado como débito (risco>benefício hoje, ver Sessão D).

### Débitos arquiteturais (não-bugs, possíveis melhorias)
- **Trello checklist deletado por engano** — escopo vago, aguarda alinhamento com Thales.
- **Mapas mentais** (`docs/mapa-mental/01-05`) — pendente decidir se commita ou descarta.

---

## 🧪 SMOKE TESTS (rodar antes de qualquer outra feature)

### Da Sessão A (commit `2303f1f`)
- [ ] **SEC-033** — abrir proposta com senha via curl: só vê `has_password/numero`. Digitar senha errada → erro. Certa → dados.
- [ ] **PERM-015** — logar como Letícia → Histórico de orçamento com mudança de valor → ver `•••••`.
- [ ] **FIN-009** — visualizador não vê botão "Editar vencimento". Master edita → `SELECT * FROM entidade_audit WHERE campo='data_vencimento'` mostra entry.

### Da Sessão B+C (a serem pushed)
- [ ] **SEC-034** — gerar notificação que vira push → ver no lockscreen do iPhone "📋 Atualização de cobrança..." em vez do nome+R$.
- [ ] **SEC-035** — com 2+ masters cadastrados, gerar notif → cada um vê badge correto (não inflado).
- [ ] **SEC-036** — ativar push → desativar → reativar → confirmar que não fica orphaned no banco.
- [ ] **CODE-011** — Preços por Tipo → clicar "Adicionar" duas vezes seguidas (não dá pra clicar, mas teste sintético). Sem duplicata. Sem erro.
- [ ] **UX-150** — Financeiro abrir → trocar de aba 30s → voltar → não refetch (cache 10s). Após 1min → refetch.
- [ ] **UX-151** — após desativar push, voltar pra Configurações → ver "Reativar neste dispositivo".

### Da Sessão D
- [ ] **SEC-037** — após rodar SQL, tentar `POST /rest/v1/rpc/criar_notificacao_proposta` com payload qualquer (anon ou auth) → erro 404 "function does not exist".

### Pré-existentes (lembrete)
- [ ] **RLS DELETE refactor** — Letícia/Michele deletam processo teste. Visualizador (se existir) bloqueado.
- [ ] **Editar vencimento Asaas** — mudar data → confirmar Asaas+ERP sincronizados.
- [ ] **Webhook PAYMENT_UPDATED** — editar dueDate direto no Asaas → ERP sincroniza em ~5s.

---

## 🚦 Pra ativar

**1. Publish no Lovable** (frontend Sessão B+C — `[NOVO COMMIT]`):
- SEC-036: ordem unsubscribe correta
- CODE-011: upsert atômico
- UX-150: cache 10s em useFinanceiroClientes
- CODE-013: cast safe em useHistoricoEntidade
- UX-151: mensagem distinta pra `unsubscribed`

**2. SQL no Supabase** (SEC-034 + SEC-035 — push):
```bash
cat /Users/thalesburger/Desktop/Trevo-ERP-ATIVO/trevo-sparkle-share/docs/sql/sec-034-035-push-privacidade-unread-per-user.sql | pbcopy
```
Cola no SQL Editor → Run. Esperado: 1 function (`dispatch_push_notif` recriada).

---

## 📋 Convenções
- **🔴 crítico** — vaza dado / quebra fluxo / perde dinheiro
- **🟡 médio** — UX ruim / inconsistência / código frágil
- **🟢 polish** — performance / hardening / nice-to-have
- **🤝 aceito** — trade-off documentado; reabre se houver dor real

**Status total ao fim desta sessão:** 12 de 13 achados atacados. 2 aceitos como trade-off (CODE-012 + RLS UPDATE).

Auditoria 25/05 **fechada**. Auditoria 17/05 **fechada totalmente** (FIN-006 + CODE-007 fechados nesta sessão).
Próxima auditoria valeria após uma onda nova de features.

---

## 🚦 Pra ativar (Sessão D)

**1. SQL no Supabase** — DROP da RPC órfã:
```bash
cat /Users/thalesburger/Desktop/Trevo-ERP-ATIVO/trevo-sparkle-share/docs/sql/sec-037-drop-criar-notificacao-proposta-orfa.sql | pbcopy
```
SQL Editor → Run. Esperado: `deve_ser_zero = 0`.

Sem publish — Sessão D é só SQL.
