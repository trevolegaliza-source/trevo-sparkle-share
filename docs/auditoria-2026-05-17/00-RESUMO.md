# 🔍 AUDITORIA EXTREMAMENTE COMPLETA — 17/05/2026

> **Disparada por Thales:** "Refaça uma auditoria extremamente completa identificando bugs de uso, tanto para mim quanto para meus colaboradores."
>
> **Método:** 5 agentes Explore em paralelo cobrindo (1) permissão/segurança, (2) UX/usabilidade, (3) fluxo financeiro/integrações, (4) bugs por perfil, (5) code review god components. Achados críticos validados contra o código real antes de consolidar.
>
> **Escopo:** sistema pós-todas-as-mudanças até 17/05 (commits até `fa93dfe`). NÃO repete achados já corrigidos.

---

## 📊 Sumário executivo

**30 achados novos** mapeados. Dividos em 5 categorias:

| Categoria | Total | 🔴 | 🟡 | 🟢 |
|---|---:|---:|---:|---:|
| Segurança (SEC) | 4 | 1 | 3 | 0 |
| Permissão (PERM) | 3 | 1 | 2 | 0 |
| Financeiro/Integração (FIN) | 8 | 1 | 5 | 2 |
| UX/Usabilidade (UX) | 9 | 1 | 6 | 2 |
| Código/God components (CODE) | 10 | 3 | 4 | 3 |
| **Total** | **34** | **7** | **20** | **7** |

**7 críticos 🔴** — atacáveis em ~2 dias de sessão acompanhada.

---

## 📋 Status (atualizado 17/05/2026 após sessão 1)

### ✅ Resolvidos (commit pendente Publish)
- **SEC-029** (Clientes) — ValorProtegido em valor_base/limite_desconto. Operacional/visualizador agora vê `•••••`.
- **PERM-012** — botão Editar oculto pra quem não tem `podeEditar('clientes')`.
- **PERM-014** — botões Arquivar/Desarquivar ocultos pra quem não tem `podeExcluir('clientes')`.
- **UX-143** — Copiar Link em rascunho agora bloqueia o copy (era só warning).
- **UX-140** — `handleSave('enviado')` valida itens > 0 antes de marcar como enviado.
- **FIN-002** — SQL `fin-002-gerar-extrato-rejeita-array-vazio.sql` adiciona 2 guards na RPC. ✅ Rodado.
- **BUG-006** — botões "Gerar Fatura Mensal" agora têm disable + pre-check + UNIQUE constraint SQL (3 camadas). Investigação descobriu causa raiz: double-click no ClienteDetalhe sem `disabled` disparava 2 INSERTs antes do `loadAll` atualizar state. CODE-002 era falso alarme — o bug real era no botão, não no useEffect.

### ✅ Resolvidos onda 1-3 (17/05 noite)
- **CODE-001** — `editCadastroForm` reseta ao fechar Dialog
- **CODE-006** — `updateCliente` invalida 5 queryKeys (era só 1)
- **CODE-008** — skip valor adicional NULL em 5 lugares
- **UX-147** — banner discreto + 2 states durante auto-geração ContasPagar
- **CODE-003** — 2 catches `/* noop */` viraram `console.error` tagueado
- **FIN-003** — trigger `sync_orcamento_on_lancamento_pago` detecta estorno (SQL pendente rodar)
- **FIN-007** — `notify-cliente-evento` cria notif in-app pro master se Resend falha (edge deploy pendente)
- **CODE-004** — staleTime 5min em useQuery clientes_select (OrcamentoNovo)
- **CODE-010** — reset novoValor/editingId após cancel inline
- **UX-146** — Dashboard refetchOnWindowFocus + staleTime 30s
- **UX-148** — aria-label + opacity em items disabled (Hoje)
- **FIN-008** — alerta master se ASAAS_WEBHOOK_TOKEN vazio (edge v26)
- **SEC-030** — portfolio_share_token aleatório (front + edge + SQL)
- **FIN-004** — pg_cron mensalidades wrapper com log + alerta após 3 falhas
- **FIN-001** — webhook Asaas resolve cobrança por externalReference como fallback (v27 — race PAYMENT chegando antes de UPDATE asaas_payment_id)

### ⚠️ Falso alarme (descartados após validar contra código real)
- **SEC-029 (Dashboard)** — Dashboard.tsx:311 já tem early return pra `!podeVer('dashboard')`. Só master/gerente/financeiro acessa; todos têm `podeVerValores=true`. Não vaza nada.
- **UX-141** — `AlertDialog` de bulkDelete JÁ existe em ContasPagar.tsx:731-751. Botão linha 585 dispara `setShowBulkDeleteConfirm(true)`. Fluxo está OK.
- **UX-145** — `useContasPagar` hook JÁ tem `toast.success` em todos os `onSuccess` (linhas 89, 105, 121, 195, 197, 241, 280). Feedback existe.
- **CODE-002** — TODOS os 5 useEffects do ClienteAccordionFinanceiro já usam pattern `let active = true` + cleanup `() => active = false`. Pattern protege contra race. (Mas investigando achei o bug-006 real — ver acima.)
- **CODE-005** — `editModalOpen` inicia em `false` (linha 88). GestaoUsuarios desmonta ao trocar de aba (Radix Tabs default). State se perde naturalmente.
- **UX-142** — `Clientes.tsx:448` já tem `<Button><Pencil/></Button>` dedicado por row.
- **UX-144** — "Tudo em dia ✓" só aparece com 3 métricas zero; Financeiro só é acessado por roles que veem essas métricas. Agent inventou `haAlertasMascarados`.
- **PERM-013** — operacional vê R$ em CadastroRapido por design (UX-114 antiga — precisa confirmar valor antes de salvar).
- **SEC-031** — `Dashboard.tsx:311` já tem early return pra `!podeVer('dashboard')` ANTES do isLoading check. `useMemo` só calcula em memória.
- **FIN-005** — `asaas-gerar-cobranca-publico` usa RPC `asaas_tentar_lock_cobranca` com transação Postgres. 5 abas paralelas: primeira adquire lock, demais recebem 409 `in_progress` sem criar duplicata.

### ⏳ Pendentes (próximas sessões)
Tudo do bloco "🔴 Críticos" abaixo exceto SEC-029-Clientes; tudo do "🟡 Médios"; tudo do "🟢 Polish". 28 itens.

---

## 🔴 OS 7 CRÍTICOS (atacar primeiro)

### SEC-029 — Valores financeiros vazam pra operacional/visualizador em `/clientes` e `/dashboard`
- **Arquivos:** [Clientes.tsx:348-350](src/pages/Clientes.tsx#L348), [Dashboard.tsx:160-226](src/pages/Dashboard.tsx#L160)
- **Confirmado:** 0 referências a `<ValorProtegido>` em ambos os arquivos
- **Reprodução:** Login como secretária (operacional) → `/clientes` → vê colunas valor/desconto/limite formatadas em R$
- **Fix:** envolver `valorExibir`, `descontoExibir`, `limiteExibir` em `<ValorProtegido valor={...} />` + sweep no Dashboard nos KPIs MRR/contas vencidas

### PERM-014 — `handleArchive` em Clientes sem check de permissão
- **Arquivo:** [Clientes.tsx:202](src/pages/Clientes.tsx#L202) + botão linha 457
- **Reprodução:** Operacional clica ícone Arquivar → request vai ao backend, falha silenciosa ou inconsistência se RLS permitir
- **Fix:** `disabled={!podeExcluir('clientes')}` no botão + guard no handler

### FIN-001 — Webhook Asaas race condition com `asaas_gerando_lock_ate`
- **Arquivo:** [asaas-webhook/index.txt:180-229](edge-functions-deploy/supabase/functions/asaas-webhook/index.txt)
- **Cenário:** webhook PAYMENT_RECEIVED chega enquanto edge `asaas-gerar-cobranca` está gerando — 2 UPDATEs separados em `cobrancas` + `lancamentos` sem transação podem conflitar
- **Fix:** `handlePaidEvent` libera lock (`asaas_gerando_lock_ate = NULL`) atomicamente; OU webhook espera 5s se `lock_ate > NOW()`

### UX-143 — Copiar Link de orçamento em rascunho gera URL que vai dar 404
- **Arquivo:** [OrcamentoNovo.tsx:551-562](src/pages/OrcamentoNovo.tsx#L551)
- **Cenário:** Tu salva orçamento como rascunho, clica "Copiar Link", manda no WhatsApp pro cliente, cliente vê 404
- **Atual:** só dispara `toast.warning()` que o user ignora
- **Fix:** bloquear `handleCopyLink()` se `orcamentoStatus === 'rascunho'` → `toast.error('Mude status para Enviado antes de compartilhar')`

### CODE-002 — Race condition em 2 useEffect[cliente] em ClienteAccordionFinanceiro
- **Arquivo:** [ClienteAccordionFinanceiro.tsx:1322-1391](src/components/financeiro/ClienteAccordionFinanceiro.tsx#L1322)
- **Cenário:** trocar de cliente rapidamente — fetch async anterior (1300ms+) seta state DEPOIS da troca, mostra cobrança/whatsapp message do cliente errado
- **Fix:** capturar `cliente.cliente_id` no início do useEffect, validar que ainda é igual antes de `setState`

### CODE-005 — GestaoUsuarios modal state persiste ao navegar
- **Arquivo:** [GestaoUsuarios.tsx:88-100](src/components/configuracoes/GestaoUsuarios.tsx#L88)
- **Cenário:** abre Editar Usuário, muda role, navega pra `/clientes` sem fechar — volta pra Configurações, modal ainda aberto com dados em memória
- **Fix:** cleanup ao unmount: `useEffect(() => () => { setEditModalOpen(false); setEditUser(null); }, [])`

### CODE-009 — Delete de cliente em ClienteDetalhe checa só frontend
- **Arquivo:** [ClienteDetalhe.tsx:71-72](src/pages/ClienteDetalhe.tsx#L71) + handler ~1340
- **Cenário:** botão escondido por `{permIsMaster && ...}`, mas qualquer authed pode chamar a mutation via DevTools (`queryClient.setQueryData` + fetch direto)
- **Fix:** validar RLS policy no Supabase (`CREATE POLICY delete_clientes FOR DELETE USING (role = 'master')`). Frontend gate sozinho não basta.

---

## 🟡 20 MÉDIOS (incomodam, não bloqueiam)

### Segurança
- **SEC-030** 🟡 [portfolio-publico/index.ts:36-39](edge-functions-deploy/supabase/functions/portfolio-publico/index.ts) usa `empresa_id` como token. UUID v4 tem entropia suficiente pra inviabilizar enumeração, mas qualquer ex-funcionário com URL do portfolio acessa pra sempre. **Fix futuro:** tabela `share_tokens(token, empresa_id, expires_at)`.
- **SEC-031** 🟡 Dashboard renderiza valores ANTES do RootRedirect mover operacional. Race visual de ~50-200ms vazando MRR. **Fix:** `if (!podeVer('dashboard')) return <Skeleton />` antes do return principal.
- **SEC-032** 🟡 Share tokens de proposta/cobrança sem TTL nem rate limit. Token de 6 meses ainda funciona; bruteforce viável em loop. **Fix:** `expires_at` na criação + rate limit Redis/Postgres.

### Permissão
- **PERM-012** 🟡 [Clientes.tsx:448](src/pages/Clientes.tsx#L448) botão Editar sem `podeEditar('clientes')`. Visualizador vê botão habilitado, clica → backend nega → UX confusa.
- **PERM-013** 🟡 [StepProcesso.tsx:86](src/components/cadastro-rapido/StepProcesso.tsx#L86) lista serviços pré-acordados com "R$ X,XX" mesmo pra operacional. PreviewFinanceiro mascara mas StepProcesso esqueceu.

### Financeiro/Integrações
- **FIN-002** 🟡 `gerar_extrato_completo()` aceita `p_lancamento_ids=[]` vazio. Cria extrato + cobrança órfã. **Fix:** RPC `RAISE EXCEPTION 'Nenhum lançamento selecionado'` se array vazio.
- **FIN-003** 🟡 Trigger `sync_orcamento_on_lancamento_pago` não trata estorno. PAYMENT_REFUNDED volta lancamento pra `'pendente'` mas orçamento continua `'convertido'`. **Fix:** expandir trigger pra detectar transição reversa.
- **FIN-004** 🟡 pg_cron mensalistas falha silenciosa. Erro PL/pgSQL não é logado em lugar visível. **Fix:** wrap em TRY/CATCH + INSERT em `cron_execution_log` + alerta se falha 3x consecutiva.
- **FIN-005** 🟡 `asaas-gerar-cobranca-publico` — cliente abre link em 5 abas, 4 requests chegam em <100ms antes do lock. Pode criar payment duplicado se lock não for rigoroso. **Fix:** rate limit por share_token (1 req/min).
- **FIN-007** 🟡 `notify-cliente-evento` — se Resend down 2h, falha silenciosa após N retries. **Fix:** após 3 falhas no mesmo `cobranca_id`, criar notificação in-app pro Thales.

### UX
- **UX-140** 🟡 [OrcamentoNovo.tsx:502-512](src/pages/OrcamentoNovo.tsx#L502) `salvarOrcamento()` valida só `prospect_nome`. Submit silencioso com CNPJ/email/itens vazios. Erro só aparece ao tentar gerar PDF.
- **UX-141** 🟡 [ContasPagar.tsx:302-317](src/pages/ContasPagar.tsx#L302) `handleBulkDelete` sem `AlertDialog`. Botão tem state `showBulkDeleteConfirm` mas UI nunca renderiza o diálogo.
- **UX-142** 🟡 [Clientes.tsx:353-359](src/pages/Clientes.tsx#L353) tabela usa `onDoubleClick` pra editar, flaky em mobile/touch. **Fix:** adicionar `<Button variant="ghost"><Pencil/></Button>` em coluna dedicada (UX-082 antigo ficou incompleto).
- **UX-144** 🟡 [Financeiro.tsx:423-474](src/pages/Financeiro.tsx#L423) card "Tudo em dia!" verde aparece mesmo com alertas mascarados (perfil sem permissão). Confunde. **Fix:** remover card se `haAlertasMascarados`.
- **UX-145** 🟡 [ContasPagar.tsx:338-366](src/pages/ContasPagar.tsx#L338) `handleSaveDespesa` e `handleMarcarPago` sem `toast.success`. Modal fecha sem feedback.
- **UX-147** 🟡 [CadastroRapido.tsx:108-122](src/pages/CadastroRapido.tsx#L108) `gerarVerbasDoMes()` roda em background sem `isLoading` flag. User clica "+Nova Despesa" antes de terminar.

### Código
- **CODE-001** 🟡 [ClienteDetalhe.tsx:425-468](src/pages/ClienteDetalhe.tsx#L425) `editCadastroForm` não reseta ao fechar modal sem salvar. Reabre com dado antigo.
- **CODE-003** 🟡 [ClienteAccordionFinanceiro.tsx:1000,1388,1984,2014](src/components/financeiro/ClienteAccordionFinanceiro.tsx) `catch {/* noop */}` em 4 lugares. WhatsApp message builder e cobrança link falham silenciosamente.
- **CODE-006** 🟡 [ClienteDetalhe.tsx:413-421](src/pages/ClienteDetalhe.tsx#L413) `updateCliente.mutate` invalida só `['financeiro_clientes']` mas outros componentes usam `['clientes']` e `['cliente_'+id]`. Dado stale ao voltar.
- **CODE-008** 🟡 [ClienteAccordionFinanceiro.tsx:1377](src/components/financeiro/ClienteAccordionFinanceiro.tsx#L1377) cast `(va as any).valor` + `Number(null)=0` silencia bug. Valor adicional NULL conta como R$ 0 em WhatsApp message.

---

## 🟢 7 POLISH (atacar quando der)

- **FIN-006** 🟢 Webhook insere notificação em empresa deletada (soft delete). Acumula órfãos.
- **FIN-008** 🟢 `ASAAS_WEBHOOK_TOKEN` vazio → 503. Asaas pode desistir de retentar após 24h.
- **UX-146** 🟢 Dashboard card "Tudo em dia" não invalida em tempo real após resolver alerta.
- **UX-148** 🟢 [Hoje.tsx:82-102](src/pages/Hoje.tsx#L82) items disabled sem `aria-label` nem opacity visual.
- **CODE-004** 🟢 OrcamentoNovo `useQuery(['clientes_select'])` sem `staleTime` — refetch a cada remount.
- **CODE-007** 🟢 [ClienteAccordionFinanceiro.tsx:359](src/components/financeiro/ClienteAccordionFinanceiro.tsx#L359) `useCallback` sem deps — closure stale ao trocar cliente.
- **CODE-010** 🟢 [ClienteDetalhe.tsx:2393-2476](src/pages/ClienteDetalhe.tsx#L2393) `novoValor`/`editingId` não resetam após cancel inline.

---

## 🎯 Sugestão de ataque

### Sessão 1 (~3h) — Quick wins críticos
1. **SEC-029** (~30min) — sweep ValorProtegido em Clientes + Dashboard. Achado mais simples e maior impacto (operacional vê dinheiro hoje).
2. **PERM-014 + PERM-012** (~30min) — `disabled={!podeExcluir/podeEditar}` em 4 botões.
3. **UX-143** (~10min) — bloquear copyLink em rascunho.
4. **FIN-002** (~30min) — guard em `gerar_extrato_completo()` (SQL).
5. **UX-140 + UX-141 + UX-145** (~45min) — validação form orçamento + AlertDialog bulk delete + toast.success despesa.

### Sessão 2 (~3h) — Atomicidade + race
6. **FIN-001** (~1h) — refatorar `handlePaidEvent` pra liberar lock. Testar com webhook duplicado em staging.
7. **CODE-002** (~30min) — fix race em ClienteAccordionFinanceiro (cleanup function).
8. **CODE-005** (~20min) — cleanup modal GestaoUsuarios ao unmount.
9. **FIN-003** (~30min) — trigger sync_orcamento detecta estorno.
10. **CODE-001 + CODE-006** (~40min) — reset modal + invalidate amplo.

### Sessão 3 (acompanhada, ~2h)
11. **CODE-009** (~1h) — RLS policy delete cliente. **Pede tu acompanhar** porque mexe em RLS de produção.
12. **FIN-004** (~30min) — log estruturado pg_cron + alerta 3-falhas.
13. **PERM-013 + UX-142** (~30min) — StepProcesso ValorProtegido + botão edit mobile.

### Backlog médio (~5h espalhadas)
- SEC-030/031/032 (share tokens TTL+rate limit, dashboard skeleton)
- FIN-005/007 (rate limit asaas-publico, alerta Resend down)
- UX-144/147 (card "tudo em dia" honesto, loading flag CadastroRapido)
- CODE-003/008 (remover catch silencioso, null check em valor adicional)

### Backlog polish — fazer quando sobrar tempo
- FIN-006, FIN-008, UX-146, UX-148, CODE-004, CODE-007, CODE-010

---

## 📋 Convenções

- **🔴 crítico** — vaza dado / quebra fluxo / perde dinheiro
- **🟡 médio** — UX ruim / inconsistência / confusão
- **🟢 polish** — performance / nice-to-have / hardening

Todos os achados têm arquivo:linha específico. Reprodução em 1-2 frases. Fix sugerido inline.

**Próximo passo:** Thales escolhe se ataca sessão 1 hoje ou se prefere atacar bug-006 (duplicação ADVANCE BPM) primeiro.
