# Auditoria Financeiro — 26/05/2026

> **Escopo:** módulo Financeiro (`Financeiro.tsx`, `ContasPagar.tsx`, `CobrancaPublica.tsx`), hooks (`useFinanceiro*`, `useAsaas`, `useContasPagar`, `useContasReceber`), edge functions Asaas (`asaas-gerar-cobranca`, `asaas-gerar-cobranca-publico`, `asaas-webhook`, `asaas-atualizar-vencimento`) e SQLs `docs/sql/feature-cobranca*`, `feature-asaas*`, `fix-*-asaas*`, `recurring-billing-mensalistas.sql`.
>
> **Método:** revisão linha-a-linha do código + comparação com auditorias anteriores (17/05 + 25/05) pra não re-listar achados já fechados. Atenção redobrada em atomicidade (Asaas ↔ ERP), idempotência de webhook, validações de input e ações irreversíveis (delete, marcar pago, alterar valor).
>
> **Status base:** FIN-001 (race fallback externalReference) ✅, FIN-002 (extrato array vazio) ✅, FIN-003 (sync orçamento estorno) ✅, FIN-008 (alerta WEBHOOK_TOKEN missing) ✅, FIN-009 (auditoria vencimento) ✅ — todos resolvidos. Próximas IDs começam em FIN-010.

---

## 🔴 Bugs críticos

### FIN-010 — Webhook Asaas NÃO valida assinatura HMAC, apenas access-token compartilhado
**Arquivo:** `edge-functions-deploy/supabase/functions/asaas-webhook/index.ts:544-552`
**Detalhe:** a única autenticação é o header `asaas-access-token` comparado timing-safe com `ASAAS_WEBHOOK_TOKEN`. Se este secret vazar (log poluído, screenshot, dev env, MITM em proxy), atacante pode forjar qualquer evento — incluindo `PAYMENT_RECEIVED` com `externalReference` válido. A nova rota de fallback FIN-001 (`fetchCobrancaByExternalReference`) torna ataque ainda mais simples: basta cobrança real estar em status `ativa` + atacante passar `payment.customer` correto. O `assertCustomerMatches` defende contra um pedaço, mas `cobrancas.cliente.asaas_customer_id` é gravado pela própria edge (não é segredo).
**Impacto:** marcar cobrança fraudulentamente como paga, lançamento vira pago + confirmado_recebimento=true, orçamento cascateia pra "convertido" (via trigger `sync_orcamento_on_lancamento_pago`). Money laundering possível.
**Fix:** Asaas suporta assinatura HMAC-SHA256 no header `asaas-signature` (vide docs Asaas). Validar isso ANTES do access-token bypass-eligible (e manter access-token como segunda camada). Sem isso, qualquer secret leaked = comprometimento total.

### FIN-011 — `useMarcarRecebido` em ContasReceber NÃO tem guard `.neq('status','pago')` (double-pay)
**Arquivo:** `src/hooks/useContasReceber.ts:96-114`
**Detalhe:** o `useMarcarPago` em `useContasPagar` (linha 180) tem `.neq('status','pago')` como audit fix #18 explicitamente pra prevenir race window entre SELECT (UI) e UPDATE. O `useMarcarPago` interno em `useFinanceiroClientes.ts:551` também tem (audit fix #19). Mas `useMarcarRecebido` em `useContasReceber.ts` (chamado por `MarcarRecebidoModal`) faz UPDATE direto sem guard. Se 2 operadores marcam recebido simultaneamente o lançamento é sobrescrito (ok, idempotente no campo), MAS `data_pagamento` pode pular sem auditoria + se já foi marcado pago com data X e depois marcado pago com data Y, sobrescreve silenciosamente — perda de auditoria contábil.
**Impacto:** se 2 cliques rápidos (mesmo operador) com data diferente, último ganha; perda de trilha.
**Fix:** adicionar `.neq('status','pago')` no UPDATE, espelhando o padrão dos outros dois locais. Mostrar toast "Pagamento já confirmado" se affected_rows=0.

### FIN-012 — `MarcarRecebidoModal` permite data de recebimento NO FUTURO sem validação
**Arquivo:** `src/components/contas-receber/MarcarRecebidoModal.tsx:16,41`
**Detalhe:** `data_pagamento` inicializa em hoje mas o `<Input type="date">` (linha 41) não tem atributo `max`. Operador pode digitar 31/12/2099 e o UPDATE passa direto. Resultado: lançamento aparece como "pago em 2099", desaparece de filtros de período até a data futura chegar. Em `MarcarPagoModal` (contas-pagar) o `max={new Date().toISOString().split('T')[0]}` existe — gap só em recebimento.
**Impacto:** lançamentos somem de relatórios. Dificuldade em conciliação.
**Fix:** `<Input type="date" max={new Date().toISOString().split('T')[0]} ...>`. Considera permitir D+1 pra pagamentos PIX após 22h (caso real raro mas existe). Mais rigoroso: backend validar `data_pagamento <= CURRENT_DATE + 1`.

### FIN-013 — `ReenviarCobrancaModal` tem CNPJ **hardcoded** quebrando multi-tenant
**Arquivo:** `src/components/contas-receber/ReenviarCobrancaModal.tsx:60`
**Detalhe:**
```ts
const txt = `Chave PIX (CNPJ): 39.969.412/0001-70\nValor: ${...}`;
```
Multi-tenant: este modal seria usado por qualquer empresa cadastrada, mas a chave PIX é fixa no CNPJ da Trevo Legaliza. Se onboardar uma segunda empresa, o "copiar chave PIX" do botão dá o CNPJ da Trevo (vazamento de dado + cliente paga errado). Mesmo problema em `src/lib/extrato-pdf.ts:11`, `src/lib/relatorio-prepago-pdf.ts:12,16` (essas pelo menos rodam server-side com dados Trevo). Também `CobrancaPublica.tsx:286` usa `wa.me/5511934927001` hardcoded como fallback de WhatsApp.
**Impacto:** primeira empresa nova que onboardar gera cobrança com CNPJ da Trevo no botão de copiar.
**Fix:** ler `empresas_config.pix_chave` + `cnpj` da empresa do usuário autenticado (já existe pra `empresa_config` no CobrancaPublica via RPC `get_cobranca_por_token` → field `empresa_config.pix_chave`). Refatorar `ReenviarCobrancaModal` pra receber a empresa_config ou consultar.

### FIN-014 — `ValoresAdicionaisModal` aceita valor **negativo** sem validação
**Arquivo:** `src/components/financeiro/ValoresAdicionaisModal.tsx:117-123,151-157`
**Detalhe:**
```ts
const valor = parseFloat(newValor.replace(',', '.')) || 0;
const isPagoCliente = permitePagoCliente && pagoPeloCliente;
if (!descricaoFinal || (valor <= 0 && !isPagoCliente)) {
  toast.error('Preencha descrição e valor');
  return;
}
```
`parseFloat('-100')` retorna `-100`, que é `> 0 === false` mas ALSO `<= 0`. Espera: este check rejeita. **Falso:** `parseFloat('-100')` é `-100`, `-100 <= 0` é `true`, então o `(valor <= 0 && !isPagoCliente)` resulta em `true && true = true` → rejeita. OK.
**Mas em `handleSaveEdit` (linha 151):**
```ts
const valor = parseFloat(editValor.replace(',', '.')) || 0;
updateMut.mutate({ id, ..., updates: { descricao: editDesc.trim(), valor } });
```
**Zero validação.** Operador pode editar valor de uma taxa pra `-500`, vira valor adicional negativo que **reduz** o total da cobrança. Combinado com `useCobrancaAsaas` recalculando `total_geral`, dá pra fazer cobrança vir negativa de fato.
**Impacto:** cliente paga R$ 100 a menos numa cobrança porque alguém editou uma taxa pra -100. Perdiamos dinheiro.
**Fix:** validar `valor > 0` (ou `>= 0` se zero faz sentido pra "pago pelo cliente") no `handleSaveEdit`. Backend (RLS + check constraint em `valores_adicionais.valor >= 0`) seria ainda mais robusto.

### FIN-015 — `gerarLancamentosRecorrentes` cria DUPLICATAS se chamado em paralelo
**Arquivo:** `src/hooks/useContasPagar.ts:331-382`
**Detalhe:** ContasPagar tem auto-trigger no `useEffect` (linha 111-126). Se 2 abas abertas com o mesmo mês selecionado: ambas fazem SELECT na tabela `lancamentos` (filtrando `despesa_recorrente_id IS NOT NULL`), ambas calculam que precisam criar X recorrentes (pois neither viu o INSERT da outra ainda), ambas INSERT. Resultado: cada recorrente criada 2x.
- `gerado` é state local (`useState`), só protege contra re-render da mesma sessão.
- A tabela `lancamentos` não tem UNIQUE em `(despesa_recorrente_id, competencia_mes, competencia_ano)` (vide `BUG-006` que adicionou UNIQUE só pra "Fatura mensal —", não pra recorrentes).
**Impacto:** dia 1 do mês, Thales abre em Mac + Letícia abre no celular → 2x salário, 2x VT, 2x DAS. Operacionalmente catastrófico.
**Fix:** adicionar `CREATE UNIQUE INDEX IF NOT EXISTS uniq_recorrente_mes ON lancamentos (despesa_recorrente_id, competencia_mes, competencia_ano) WHERE despesa_recorrente_id IS NOT NULL;`. Frontend já roda com `.then(count > 0) toast`; com unique no banco, segunda tentativa quebra silenciosa (catch genérico).

---

## 🟡 Melhorias

### FIN-016 — Cobrança **paga** ou **cancelada** ainda permite re-gerar via `asaas-gerar-cobranca-publico`
**Arquivo:** `edge-functions-deploy/supabase/functions/asaas-gerar-cobranca-publico/index.ts:186-203`
**Detalhe:** o lock RPC `asaas_tentar_lock_cobranca` valida status — só permite `ativa`/`vencida`. Mas há subtileza: a versão PRIVADA (`asaas-gerar-cobranca`) faz tenant check antes do lock; a versão PÚBLICA confia 100% no lock. Se a RPC `asaas_tentar_lock_cobranca` (não auditada aqui — fonte: docs/sql) for permissiva ou tiver bug, a versão pública dispara `createPayment` no Asaas mesmo pra cobrança paga. Resultado: paga + nova cobrança duplicada no painel Asaas. Já vi este padrão de erro no flush 14/05.
**Impacto:** baixo (lock RPC parece OK) mas defense-in-depth ausente.
**Fix:** na pública, replicar o `if (cobranca.status === 'paga' || cobranca.status === 'cancelada') return reused`. Hoje a checagem só vive na RPC.

### FIN-017 — Edge `asaas-atualizar-vencimento` **NÃO faz lock** entre PUT Asaas + UPDATE banco
**Arquivo:** `edge-functions-deploy/supabase/functions/asaas-atualizar-vencimento/index.ts:144-179`
**Detalhe:** fluxo é:
1. SELECT cobrança
2. PUT `/payments/:id` no Asaas
3. UPDATE `cobrancas` localmente
4. UPDATE `lancamentos` vinculados

Se 2 operadores alteram vencimento simultaneamente:
- Both fazem PUT Asaas com datas diferentes (último ganha no Asaas)
- Both fazem UPDATE banco com datas diferentes (último ganha no banco)
- Não há garantia de mesma ordem ⇒ Asaas pode ficar com data A e banco com data B.

Quando webhook `PAYMENT_UPDATED` chega de volta com data A, o handler vai sobrescrever banco — autocorrige. Mas janela de inconsistência existe (segundos a minutos).
**Impacto:** raro mas existe. Operador faz fix de data, vê banco mudado, fala "ok pro cliente". Webhook chega e reverte pra outra data (do outro operador).
**Fix:** mesmo padrão de `asaas_tentar_lock_cobranca` mas pra UPDATE de vencimento. Ou: usar `SELECT FOR UPDATE` na RPC. Alternativa pragmática: notificar via toast "Outra alteração pendente, aguarde X" antes do PUT.

### FIN-018 — `handleConfirmDesfazer` em ContasPagar **NÃO** limpa `data_pagamento` no histórico de auditoria
**Arquivo:** `src/pages/ContasPagar.tsx:229-245`
**Detalhe:** "Desfazer pagamento" usa `updateDespesa.mutate({ id, status:'pendente', data_pagamento:null, comprovante_url:null })`. Não há nenhum registro em `entidade_audit` ou tabela equivalente — comparado com FIN-009 que SIM grava (em vencimento). Operador desfaz pagamento de R$ 50.000 → ninguém sabe quem ou por que (motivo é capturado em `desfazerMotivo` mas DESCARTADO depois).
**Impacto:** zero rastreabilidade em ação destrutiva. Linha 220-221: "_Spec: só admin (podeAprovar), janela 24h, motivo opcional, **sem histórico**._" — decisão consciente mas fragiliza auditoria.
**Fix:** gravar `desfazerMotivo` no `notas_cobranca` ou nova tabela `lancamento_audit`. Custo trivial, valor enorme.

### FIN-019 — `EditarVencimentoButton` permite voltar pra **passado** (D-180)
**Arquivo:** `src/components/financeiro/EditarVencimentoButton.tsx:99-106`
**Detalhe:** `<Input min={hoje} max={maxDate}>` onde `maxDate = hoje + 180d`. UI bloqueia datas passadas. **MAS** o `handleSubmit` (linha 38-65) só valida regex YYYY-MM-DD. Manipulação via DevTools (ou navegador antigo) consegue submeter `2020-01-01`. Edge function (`asaas-atualizar-vencimento`) também só valida regex (linha 100). Asaas PUT pode aceitar data passada ou rejeitar — depende do API.
**Impacto:** baixo (depende do Asaas), mas se Asaas aceitar passa a ter "boleto vencido na criação". Cliente vê valor + multa + juros dia 1.
**Fix:** revalidar `nova_data_vencimento >= CURRENT_DATE` no edge function (defesa em profundidade — não confiar no frontend).

### FIN-020 — `asaas_status` enum NÃO trata `CHARGEBACK_REQUESTED` / `CHARGEBACK_DISPUTE` / `AWAITING_CHARGEBACK_REVERSAL`
**Arquivo:** `edge-functions-deploy/supabase/functions/asaas-webhook/index.ts:623-655`
**Detalhe:** o `switch (eventType)` cobre confirmed/received/overdue/deleted/restored/refunded/updated/created/awaiting_risk/risk_approved/etc. **Não cobre os 3 chargeback events** que Asaas emite. Resultado: chargeback chega → cai no `default` → loga `[asaas-webhook] evento não tratado` e segue. Cobrança fica como "paga" mesmo após o cliente disputar via cartão e o dinheiro voltar.
**Impacto:** pagamento revertido pelo banco do cliente → ERP continua mostrando "pago". Conciliação financeira manual obrigatória.
**Fix:** adicionar handlers pra `PAYMENT_CHARGEBACK_REQUESTED` (vira `disputado`, notifica master), `PAYMENT_CHARGEBACK_DISPUTE` (idem), `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` (volta pra `pendente`, lança nota). Mesmo template do `handleRefundedEvent`. Se a Trevo só usa boleto+PIX (`billingType: UNDEFINED` mas sem cartão), risco é baixo — mas Asaas pode ativar cartão sem que código mude.

### FIN-021 — `criar_processo_com_lancamento` deduz **saldo pré-pago** FORA da RPC, sem rollback
**Arquivo:** `src/hooks/useFinanceiro.ts:612-636`
**Detalhe:** após a RPC `criar_processo_com_lancamento` (atômica) retornar com `processoId`, o frontend:
1. Faz SELECT manual de `saldo_prepago`
2. Calcula `novoSaldo = saldoAtual - valorFinal`
3. Verifica `novoSaldo < 0` → throw
4. UPDATE `clientes.saldo_prepago`
5. INSERT em `prepago_movimentacoes`

Problemas:
- TOC TOU clássico: dois processos pré-pago criados em paralelo leem mesmo `saldoAtual`, ambos passam check, ambos UPDATE — saldo fica negativo. RLS não bloqueia (operação legítima).
- Se passo 4 ou 5 falhar, **o processo + lançamento JÁ FORAM CRIADOS** pela RPC. Cliente vê processo, banco não foi descontado. Inverso também: 4 ok, 5 falha → desconto sem rastro.
- Comentário linha 612 diz "uses permissive RLS" — admite o problema mas não corrige.
**Impacto:** saldo pré-pago pode ficar negativo ou desincronizado de movimentações. Caso real possível com mensalistas+pré-pago.
**Fix:** mover dedução de saldo pra dentro da RPC `criar_processo_com_lancamento` (mesmo padrão atômico). Padrão SELECT FOR UPDATE em `clientes.saldo_prepago`. RPC retorna saldo novo no JSON.

### FIN-022 — `CobrancaPublica` não invalida `localStorage` quando cobrança é re-rotacionada
**Arquivo:** `src/pages/CobrancaPublica.tsx:114-130`
**Detalhe:** confetti usa `localStorage.getItem('cobranca:confetti:${cobrancaId}')` com TTL 1 ano. Se a cobrança for paga, depois cancelada (refund), depois reaberta com novo `share_token` mas mesmo `cobranca_id`, e novamente paga: confetti não dispara (key já existe). Caso edge mas é UX inconsistente. Mais importante: dedupe é via `cobranca_id` mas a key é gravada no browser do cliente — se 5 clientes acessam o mesmo link, cada um vê confetti uma vez (correto). Não é bug crítico, mas vale documentar.
**Impacto:** baixo. Comportamento documentado em UX-024 mas pode confundir após refund.
**Fix:** opcionalmente expor `cobranca.confetti_visto_em` no banco (já mencionado no comentário linha 121-123).

### FIN-023 — Number to BRL: `formatBRL` em vários lugares usa `Number()` sem `Number.isFinite` check
**Arquivo:** múltiplos — exemplos: `src/pages/Financeiro.tsx:113`, `src/pages/ContasPagar.tsx:336-339`, `src/components/contas-pagar/MarcarPagoModal.tsx:115`
**Detalhe:** `Number(l.valor)` quando `l.valor` é NaN, null, undefined ou string inválida retorna NaN. `Number(NaN).toLocaleString(...)` retorna `"R$ NaN"` em pt-BR. Aparece visualmente no Financeiro se algum lançamento tiver `valor=null` (raro mas possível em legacy).
**Impacto:** UI quebrada (visual feio mas não corrupção). Total de KPIs vira NaN se algum item for null.
**Fix:** helper `safeNumber(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }` e usar em todas reduce/sum. Ou validate at boundary (no useFinanceiro response).

### FIN-024 — `useDeleteDespesa` em ContasPagar **NÃO checa permissão** antes do DELETE
**Arquivo:** `src/hooks/useContasPagar.ts:111-125`
**Detalhe:** `useDeleteLancamento` em `useFinanceiro.ts:888-905` tem o check `if (!data || data.length === 0) throw 'Sem permissão pra excluir'` — proteção depende do RLS DELETE retornar 0 linhas. Mas `useDeleteDespesa` (ContasPagar) faz `delete().eq('id', id)` sem RETURNING + sem check. Se RLS DELETE bloquear (visualizador), o operador vê toast "Despesa excluída!" mesmo nada tendo acontecido. Engana.
**Impacto:** usuário pensa que deletou, refresh mostra despesa de volta. Confusão (sem dano).
**Fix:** copiar padrão de `useDeleteLancamento`: `.delete().select('id'); if (!data?.length) throw`.

### FIN-025 — Auto-folha (`gerarVerbasDoMes`) chamado em loop por `useEffect` sem debounce/lock
**Arquivo:** `src/pages/ContasPagar.tsx:135-170`
**Detalhe:** o `useEffect` que auto-gera folha depende de `[viewMonth, viewYear, folhaGerada, colaboradores, queryClient]`. Se `colaboradores` re-render por qualquer mudança upstream (refetch, novo cadastro), e o hash de campos relevantes mudar (mudou `dia_salario` de um colaborador), o effect dispara `gerarVerbasDoMes`. Idempotente em design (upsert pendente, pula pago), mas se o usuário trocar mês rapidamente entre 5 meses, dispara 5 chamadas em sequência.
**Impacto:** banner "Atualizando..." pisca várias vezes. Performance ok mas UX feia.
**Fix:** debounce (300ms) o `viewMonth+viewYear` antes do effect; ou flag global `geracaoAtiva` que bloqueia re-entry.

---

## 🟢 OK / Boas práticas identificadas

### FIN-026 — Lock atômico em `asaas-gerar-cobranca` via RPC com CAS
- `asaas_tentar_lock_cobranca` retorna `{ acquired, reason, status }` cobrindo 5 cenários (not_found, wrong_status, already_generated, in_progress, acquired). Padrão correto e bem documentado.

### FIN-027 — Webhook idempotência via UNIQUE INDEX em `asaas_webhook_events.event_id`
- Conflict 23505 = duplicate, retorna 200 sem reprocessar. Robusto contra retries do Asaas.

### FIN-028 — Distinção `BusinessRuleError` vs erro transitório
- Audit fix #3: business rule → 200 (não retenta, registra), transitório → 500 (Asaas retenta com backoff). Pattern correto.

### FIN-029 — `customer mismatch` check no webhook
- `assertCustomerMatches` valida que `payment.customer` bate com `clientes.asaas_customer_id`. Bloqueia webhook forjado com payment_id válido mas customer divergente.

### FIN-030 — FAIL-FAST se `ASAAS_WEBHOOK_TOKEN` não configurado
- Retorna 503 (Asaas retenta) + alerta in-app pros masters (throttle 24h). Boa prática operacional.

### FIN-031 — `valor_original` + `valor_alterado_por` + `valor_alterado_em` em `lancamentos`
- Trilha de auditoria pra qualquer alteração de valor (audit fix #17). `alterar_valor_lancamento` RPC atômica garante consistência processo↔lançamento.

### FIN-032 — `desfazer_marcar_pago` agora **só via RPC** (com tenant check)
- Fallback de UPDATE direto removido (audit-sprint-3.1). Não dá mais pra qualquer user da empresa desfazer pagamento de qualquer processo passando ID direto.

### FIN-033 — `tentar_aplicar_boas_vindas` + `reverter_boas_vindas` (atomicidade)
- SELECT FOR UPDATE + UPDATE atômico. Try/catch externo no `useCreateProcesso` reverte se o processo falhar de criar. Sem isso, cliente perdia direito ao desconto.

### FIN-034 — `marcar_processo_pago` RPC atômica
- Espelha exatamente o comportamento do `ja_pago=true` no cadastro. Tenant check no banco. Lançamento+processo num único bloco PL/pgSQL.

### FIN-035 — `gerar_extrato_completo` rejeita array vazio (FIN-002 fechado)
- Validation no topo da função impede cobrança órfã ligada a 0 lançamentos.

### FIN-036 — `staleTime: 10s` em `useFinanceiroClientes` (UX-150 corrigido)
- Antes era `0` → refetch a cada blur/focus. Agora ainda essencialmente fresh, mas evita refetch desnecessário.

### FIN-037 — Comprovante de pagamento **opcional** (relax 17/05)
- `pode_avancar_cobranca` permite marcar pago sem comprovante quando faz sentido (cliente pagou via PIX, registrado a olho). Ergonomia operacional.

### FIN-038 — `EditarVencimentoButton` consolidado em `DetalhesCobrancaModal` (audit 25/05)
- Single source of truth pro fluxo de editar vencimento. Removida duplicata.

### FIN-039 — Tipo PF + PJ no `ensureCustomer`
- Asaas aceita `cpfCnpj` único campo. Validação 11/14 dígitos correta. Resolve caso 18/05.

### FIN-040 — `cron processar_mensalidades_recorrentes` é idempotente
- Check `EXISTS (... competencia_mes/ano + descricao ILIKE 'Mensalidade%')` antes de criar. Re-rodar não duplica.

---

## 📊 Resumo

| Categoria | Total | 🔴 Crítico | 🟡 Melhoria | 🟢 OK |
|---|---:|---:|---:|---:|
| Achados | **31** | 6 | 10 | 15 |

### Distribuição por área
- **Atomicidade Asaas ↔ ERP:** FIN-016, FIN-017, FIN-021 (3 melhorias — gaps em locks/fluxos paralelos não fatais hoje, mas conhecidos)
- **Idempotência webhook:** FIN-010 (crítico — sem HMAC), FIN-020 (eventos chargeback faltam)
- **Validações de input:** FIN-012 (data futura no recebido), FIN-014 (valor negativo), FIN-019 (data passada no Asaas edge)
- **Race conditions:** FIN-011 (double-pay receber), FIN-015 (duplicata recorrente — sem unique no banco)
- **Multi-tenant:** FIN-013 (CNPJ hardcoded — quebra na primeira empresa nova)
- **Auditoria/rastreabilidade:** FIN-018 (desfazer sem trilha)

### Próxima sessão sugerida
1. **FIN-010 (HMAC webhook)** primeiro — risco financeiro direto.
2. **FIN-015 (UNIQUE recorrente)** — operacional, dia 1 do mês é gatilho.
3. **FIN-013 (CNPJ hardcoded)** — bloqueia onboarding multi-tenant.
4. **FIN-014 (valor negativo)** — fácil de explorar internamente.
5. **FIN-020 (chargeback)** — se cartão for habilitado no Asaas algum dia.

### Não revisitados (já fechados em auditorias anteriores)
- FIN-001 (race externalReference) ✅, FIN-002 (extrato vazio) ✅, FIN-003 (estorno sync) ✅, FIN-004 (cron log) ✅, FIN-006 (notif empresa) ✅, FIN-008 (alerta webhook missing) ✅, FIN-009 (auditoria vencimento) ✅, BUG-006 (unique fatura mensal) ✅, audit fix #17/18/19 (race double-pay/double-update) ✅, audit fix #3 (status honesto webhook) ✅.
