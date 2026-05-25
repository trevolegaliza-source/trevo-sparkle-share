# 🔍 AUDITORIA PÓS-VIAGEM — 25/05/2026

> **Disparada por Thales:** após retorno da viagem, refazer auditoria considerando 51 commits desde a última (45 em 18/05 + 6 hoje).
>
> **Método:** 2 agentes paralelos — (A) revisão de status dos 34 achados de 17/05, (B) varredura nova em código pós-17/05. Críticos validados manualmente contra código real antes de consolidar.
>
> **Escopo:** sistema pós-todas-as-mudanças até commit `f63b15d` (RLS DELETE refactor aplicado em prod hoje).

---

## 📊 Sumário executivo

### Auditoria 17/05 — **essencialmente fechada**
- ✅ **24 CORRIGIDOS** (18 fixes diretos + 6 marcados resolvidos no RESUMO original)
- ❌ **8 FALSO ALARME** já catalogados
- ⏳ **2 PENDENTES** (FIN-006 polish + CODE-007 fantasma)
- 🤷 **1 NÃO VERIFICÁVEL** (edge function fora do repo)

### Achados novos 25/05
- 🔴 **4 críticos** — vazamento dados em RPC pública, push lockscreen, histórico vaza valor, edit vencimento sem gate
- 🟡 **5 médios** — race no upsert, badge unread inflado, vencimento sem max, push subscription orphan, trigger fire-and-forget
- 🟢 **3 polish** — flicker em listagens, cast unsafe, mensagem confusa em push

### Estado da plataforma
- **Frontend:** commit `f63b15d` no `main` (publish feito)
- **Edge `asaas-webhook`:** v30 (PAYMENT_UPDATED handler aplicado)
- **Edge `asaas-atualizar-vencimento`:** v1 (aplicada 24/05)
- **Edge `enviar-push`:** ativa (deploy 18/05)
- **SQL RLS DELETE refactor:** ✅ aplicado em prod hoje (23 policies + função `tem_permissao_excluir`)

---

## 🔴 4 CRÍTICOS NOVOS

### SEC-033 — Senha de proposta pública é só UI, dados vazam pela RPC
- **Arquivos:** [PropostaPublica.tsx:572-578](src/pages/PropostaPublica.tsx#L572) + [docs/sql/get-proposta-por-token-permite-convertido.sql:20,43](docs/sql/get-proposta-por-token-permite-convertido.sql#L20)
- **Severidade:** ALTA — vaza dados financeiros confidenciais
- **Reprodução:** curl `POST /rest/v1/rpc/get_proposta_por_token` com `share_token` retorna 40+ campos (`valor_final`, `prospect_cnpj`, `servicos`, etc) + `has_password: true`. Frontend só renderiza tela de senha por cima de dados já em memória. Atacante via DevTools → `console.log(orc)` → vê tudo sem digitar senha.
- **Fix proposto:** bifurcar a RPC:
  - `get_proposta_por_token` (sem senha) retorna só `{has_password, numero, escritorio_nome}`
  - `get_proposta_por_token_com_senha(p_token, p_senha)` faz match SQL e retorna o resto
- **Esforço:** ~1h (RPC SQL + ajuste em PropostaPublica.tsx)

### SEC-034 — Push notification expõe nome cliente + valor no lockscreen
- **Arquivos:** [docs/sql/notif-master-funcionario-criou.sql:77-81](docs/sql/notif-master-funcionario-criou.sql#L77) + [docs/sql/dispatch-push-on-notif.sql:84-91](docs/sql/dispatch-push-on-notif.sql#L84) + [public/sw.js:23-30](public/sw.js#L23)
- **Severidade:** MÉDIA-ALTA — exposição em ambiente físico (telefone na mesa numa reunião)
- **Reprodução:** Letícia cadastra processo "Padaria do João — R$ 2.500". Trigger gera `notificacoes.mensagem` com texto literal. `dispatch_push_notif` envia `body = v_notif.mensagem` verbatim. iPhone do Thales na mesa numa reunião com cliente → todos veem.
- **Fix proposto:** separar `notificacoes.mensagem_push` (curta/genérica: "Novo processo cadastrado") de `notificacoes.mensagem` (completa, acessível só após login). Ou: no `sw.js` exibir só "Trevo ERP — atividade" + "Toque para ver"; mensagem real fica in-app.
- **Esforço:** ~1h (SQL + sw.js + edge enviar-push)

### PERM-015 — Histórico de orçamentos/processos vaza valores pra operacional
- **Arquivos:** [HistoricoEntidadeModal.tsx:60-64](src/components/historico/HistoricoEntidadeModal.tsx#L60) + [docs/sql/historico-entidade-audit.sql:40-43](docs/sql/historico-entidade-audit.sql#L40)
- **Severidade:** ALTA — SEC-029 (já corrigido) protegeu `valor_base` mas histórico ignorou
- **Reprodução:** Secretária (operacional) abre OrcamentoNovo de orçamento existente → clica "Histórico" → vê linhas tipo `valor_final: R$ 5.000,00 → R$ 4.500,00`. Operacional não deveria ver R$.
- **Fix proposto:** opção mais simples — em `HistoricoEntidadeModal`, envolver valores em `<ValorProtegido>` quando campo for `valor*`. Opção mais robusta — RPC `listar_historico_entidade` filtra fora campos financeiros quando role não é master/financeiro/gerente.
- **Esforço:** ~20min (frontend) ou ~40min (SQL + frontend)

### FIN-009 — `EditarVencimentoButton` sem permission gate + sem auditoria
- **Arquivos:** [EditarVencimentoButton.tsx](src/components/financeiro/EditarVencimentoButton.tsx) + [ClienteAccordionFinanceiro.tsx:1313,1716](src/components/financeiro/ClienteAccordionFinanceiro.tsx#L1313) + [DetalhesCobrancaModal.tsx](src/components/financeiro/DetalhesCobrancaModal.tsx)
- **Severidade:** ALTA — qualquer perfil com módulo `financeiro` (inclui visualizador) muda data de cobrança em prod Asaas + ERP sem trilha
- **Reprodução:** Visualizador (que tem módulo `financeiro` por algum motivo) clica "Editar vencimento" → invoca edge → muda data no Asaas. Sem `disabled={!podeEditar('financeiro')}`, sem entry em `entidade_audit`, sem confirm grande.
- **Fix proposto:**
  1. `disabled={!podeEditar('financeiro')}` em ambos os botões (EditarVencimentoButton + DetalhesCobrancaModal)
  2. Edge `asaas-atualizar-vencimento` grava entry em `entidade_audit` (campo `data_vencimento`, valor antigo → novo, ator)
  3. Considerar refactor análogo ao DELETE: criar `tem_permissao_editar(p_modulo)` + RLS UPDATE em cobrancas/lancamentos
- **Esforço:** ~30min frontend + ~30min auditoria. Refactor UPDATE RLS = sessão dedicada (~2h)

### **Bônus de descoberta nesta auditoria:**
Há **DOIS componentes "EditarVencimento"** redundantes:
- `EditarVencimentoButton.tsx` (commit `92bd1a2` 18/05) — usado em listas
- Dialog dentro de `DetalhesCobrancaModal.tsx` (commit `391ec8d` 25/05) — criado por mim hoje sem perceber que já existia

**Recomendação:** consolidar pra usar só `EditarVencimentoButton.tsx` em ambos os lugares. ~15min.

---

## 🟡 5 MÉDIOS NOVOS

### SEC-035 — Push `unread_count` é soma global, não por destinatário
- **Arquivo:** [docs/sql/dispatch-push-on-notif.sql:65-68](docs/sql/dispatch-push-on-notif.sql#L65)
- **Repro:** notificação multi-master usa `v_unread = count WHERE destinatario_id = ANY(masters)`. Cada master recebe o mesmo número (inflado).
- **Fix:** loop por user e chamada de push individual com `v_unread` específico.

### CODE-011 — `useUpsertClientePrecoTipo` faz SELECT+INSERT/UPDATE não-atômico
- **Arquivo:** [useFinanceiro.ts:265-285](src/hooks/useFinanceiro.ts#L265)
- **Status:** PARCIAL — `cliente_precos_por_tipo` JÁ TEM UNIQUE (cliente_id, tipo). Sem risco de duplicata, mas race de last-write-wins entre 2 cliques rápidos.
- **Fix:** trocar pra `.upsert(..., { onConflict: 'cliente_id,tipo' })` + `disabled` enquanto pending.

### UX-149 — `EditarVencimentoButton` aceita vencimento anos no futuro sem confirmação
- **Arquivo:** [EditarVencimentoButton.tsx:86](src/components/financeiro/EditarVencimentoButton.tsx#L86)
- **Repro:** input sem `max`, digitar `2076` no ano passa direto.
- **Fix:** `max={hojePlus180dias}` + AlertDialog com diff humano antes do invoke.

### SEC-036 — `unsubscribe` push deleta DB antes de unsubscribe do browser
- **Arquivo:** [usePushNotifications.ts:92-107](src/hooks/usePushNotifications.ts#L92)
- **Repro:** `delete` Supabase roda antes de `sub.unsubscribe()`. Se browser falha → orphaned subscription continua recebendo do edge.
- **Fix:** ordem invertida (unsubscribe browser → delete DB) + check de erro.

### CODE-012 — `dispatch_push_notif` fire-and-forget dentro de trigger
- **Arquivo:** [docs/sql/dispatch-push-on-notif.sql:78-92](docs/sql/dispatch-push-on-notif.sql#L78)
- **Repro:** trigger AFTER INSERT dispara `net.http_post`. Se a transação rollback depois, push já foi enviado — user recebe alerta de evento inexistente.
- **Fix:** mover disparo pra cron que lê `notificacoes` com `push_enviado_em IS NULL`.

---

## 🟢 3 POLISH NOVOS

### UX-150 — Cache 30s + windowFocus refetch pode causar flicker em listagens
- **Arquivo:** [App.tsx:56-58](src/App.tsx#L56) + [useFinanceiroClientes.ts:275](src/hooks/useFinanceiroClientes.ts#L275)
- **Repro:** mudança default global pra `staleTime: 30s + refetchOnWindowFocus: true` (commit `3b94fee` hoje) somado com override `staleTime: 0` em `useFinanceiroClientes` pode causar refetch toda troca de aba.
- **Fix:** trocar override pra `staleTime: 10_000` no hook — ainda fresco, menos refetch.

### CODE-013 — `useHistoricoEntidade` cast `as HistoricoEntry[]` sem validar shape
- **Arquivo:** [useHistoricoEntidade.ts:30-32](src/hooks/useHistoricoEntidade.ts#L30)
- **Fix:** `return Array.isArray(data) ? (data as HistoricoEntry[]) : [];`

### UX-151 — Push: `unsubscribed` vs `default` confunde o usuário
- **Arquivo:** [PushNotificationsCard.tsx:73-77](src/components/configuracoes/PushNotificationsCard.tsx#L73)
- **Fix:** diferenciar mensagem entre "permissão nunca dada" e "permissão dada mas inscrição cancelada".

---

## 🔬 INVESTIGAR (não confirmado sem mais código)

- **`criar_notificacao_proposta` aceita texto arbitrário do anon?** RPC fora do repo. Se aceita `p_mensagem` literal e insere em `notificacoes.mensagem`, atacante com share_token gera push lockscreen com texto arbitrário (junta com SEC-034 e fica grave).
- **Pessoa Física + Asaas:** `asaas-gerar-cobranca` edge não está no repo. Validar se `tipo_pessoa='PF'` + `cpf` gera boleto/PIX corretamente.
- **RLS DELETE refactor (aplicado hoje):** pré-flight só checou 2 não-masters atuais. Testar com 3º usuário antes de declarar OK.

---

## 🧪 TESTES PENDENTES (features dos últimos 7 dias)

### Críticos (precisa rodar antes de qualquer outra feature)
- [ ] **Editar vencimento Asaas** — abrir cliente → cobrança PENDING → "Detalhes" → "Editar" → mudar data → confirmar no painel Asaas que `dueDate` mudou
- [ ] **Webhook PAYMENT_UPDATED** — editar `dueDate` direto no painel Asaas → confirmar que ERP sincroniza em ~5s + master recebe notif "📅 Vencimento alterado no Asaas"
- [ ] **RLS DELETE refactor** — logar como Letícia/Michele → tentar deletar processo de cliente teste (deve funcionar). Logar como visualizador (se criar) → tentar deletar → deve bloquear
- [ ] **Preços por tipo** — cliente VITAE → "Preços diferenciados por tipo" → adicionar abertura R$ 540 → criar processo de abertura → confirmar valor calculado é R$ 540 (não valor_base do cliente)
- [ ] **Histórico em OrcamentoNovo** — editar orçamento → mudar valor → salvar → clicar "Histórico" → ver linha "valor → novo valor"

### Médios
- [ ] **Cache global 30s + windowFocus** — abrir Financeiro/Clientes/Processos → ir pra outra aba 1min → voltar → confirmar dados refrescaram
- [ ] **Operacional + orçamentos** — Letícia/Michele criam novo orçamento (template inclui `orcamentos` agora)

### Pré-existentes que vale confirmar
- [ ] **Push notifications PWA** — instalar PWA no iPhone (Letícia, Michele) → cadastrar processo → confirmar push no lockscreen
- [ ] **CPF (PF) em cliente** — criar cliente PF → gerar cobrança Asaas → confirmar que Asaas aceitou CPF

---

## 🎯 Sugestão de ataque

### Sessão A (~2h) — Críticos novos
1. **SEC-033** (~1h) — bifurcar RPC `get_proposta_por_token`. Maior risco do sistema agora.
2. **PERM-015** (~20min) — ValorProtegido em HistoricoEntidadeModal.
3. **FIN-009** (~30min) — gate `podeEditar('financeiro')` + entry em `entidade_audit` no edge.
4. Consolidar **EditarVencimentoButton** vs duplicata (~15min)

### Sessão B (~1,5h) — SEC-034 + médios novos
5. **SEC-034** (~1h) — separar `mensagem_push` de `mensagem`.
6. **UX-149** (~10min) — `max` no input date.
7. **CODE-011** (~10min) — upsert atômico.
8. **SEC-036** (~10min) — ordem unsubscribe.

### Sessão C (~1h) — Polish + RLS UPDATE refactor (acompanhada)
9. **CODE-012** (~30min) — push em cron, não trigger.
10. **RLS UPDATE refactor** (~30min) — análogo ao DELETE pra cobrancas/lancamentos.

### Backlog perene
- Trello checklist (escopo vago — aguarda alinhamento)
- Mapas mentais de fluxos (untracked: `docs/mapa-mental/01-05`)
- Investigar Pessoa Física no Asaas com casos reais

---

## 📋 Convenções
- **🔴 crítico** — vaza dado / quebra fluxo / perde dinheiro
- **🟡 médio** — UX ruim / inconsistência / código frágil
- **🟢 polish** — performance / hardening / nice-to-have

Achados com arquivo:linha. Reprodução em 1-2 frases. Fix sugerido inline.

**Próximo passo:** Thales escolhe se ataca Sessão A (críticos) hoje ou se prefere fazer smoke tests das features 25/05 primeiro.
