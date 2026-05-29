# AUDITORIA COMPLETA DO ERP TREVO — 29/05/2026

Auditoria executada em 4 frentes paralelas: frontend, backend (edges + RPCs + SQLs),
schema Postgres (RLS, triggers, integridade) e segurança.

**Inventário geral:**
- Frontend: 34 páginas, 168 componentes, 39 hooks, 34 libs (~67.973 LOC)
- Backend: 11 edge functions documentadas + ~4 em prod sem source no repo, ~90 SQLs, 73 RPCs
- Banco: 52 tabelas, 7 views, 40 triggers, 171 indexes, 160 policies RLS
- Integrações: Asaas, ClickSign, Trello, PDFShift, Google Docs API, Resend

---

## 🚨 ACHADOS CRÍTICOS (atacar antes de qualquer feature)

### SEC: 5 edge functions sensíveis SEM autenticação

| # | Edge Function | Risco | Fix |
|---|---|---|---|
| **AUDIT-001** | `trello-label-lembrete` | Aceita qualquer POST. Dispara emails Resend ao cliente. Atacante posta payload forjado → phishing + quota Resend esgotada | Copiar HMAC SHA-1 do `trello-guard` |
| **AUDIT-002** | `enviar-email-mensalidade` | Body `{lancamento_id}` → envia email. Sem auth. Spam mass scale | Token interno `INTERNAL_TRIGGER_TOKEN` |
| **AUDIT-003** | `notify-cliente-evento` | Idem. 3 tipos email × 1000 clientes = 3000 spam grátis | Token interno |
| **AUDIT-004** | `enviar-push` | Recebe subscription qualquer + URL controlada. Push phishing | Validar subscription ownership + allowlist URL |
| **AUDIT-005** | `enviar-recibo-cobranca` | Sem auth, dispara notif master + marca `recibo_enviado_em` | Token interno |
| **AUDIT-006** | `gerar-proposta-msa-pdf` (FULL + index versão antiga) | Sem auth. Atacante força regenração de PDF (custo PDFShift + Google Docs) | JWT + role check |

### SCHEMA: 2 bugs de RLS

| # | Tabela / View | Problema |
|---|---|---|
| **AUDIT-007** | `cobrancas_auditoria` | RLS DESABILITADA. Qualquer usuário autenticado lê auditoria de qualquer empresa |
| **AUDIT-008** | View `processos_zombies` | Sem `security_invoker=on`. Vaza dados de outras empresas se acessada por authenticated |

### DADOS: Integridade comprometida

| # | Achado | Detalhe |
|---|---|---|
| **AUDIT-009** | 11 cobranças com `lancamento_id` órfão | Todas de maio/2026. 1 paga, 4 ativas, 5 vencidas, 1 cancelada. Lançamentos foram deletados (cascade processo? cleanup ADVANCE BPM?). Precisa reconciliar |

### CÓDIGO: Source-of-truth divergente

| # | Achado | Detalhe |
|---|---|---|
| **AUDIT-010** | 4 edge functions em prod sem código no repo | `verify-master-password`, `provisionar-cliente-trello`, `trello-reconciliacao`, `trello-guard`. Risco: refatoração quebra silenciosamente |
| **AUDIT-011** | 8+ versões de `get_proposta_por_token` em diferentes SQLs sem ordem documentada | Última execução vence. Não sabemos qual está em prod |
| **AUDIT-012** | 2 versões coexistindo de `gerar-proposta-msa-pdf` (FULL + index antigo) | Chamadas podem confundir-se |

---

## ⚠️ ACHADOS MÉDIOS

### Frontend

| # | Achado | Detalhe |
|---|---|---|
| **AUDIT-013** | 3 componentes monstro >2000 LOC | `ClienteDetalhe.tsx` 2734, `ClienteAccordionFinanceiro.tsx` 2599, `TerceirizacaoPublicaView.tsx` 2056. Concentram bugs e re-renders agressivos. Quebrar |
| **AUDIT-014** | 593 ocorrências de `as any` em mutações | Mascara typing Supabase. Tipar corretamente |
| **AUDIT-015** | 15 `window.confirm/alert` em vez de `AlertDialog` | Inconsistência visual em ações destrutivas (Excluir proposta, aprovar acesso usuário) |
| **AUDIT-016** | 67 mutations sem `invalidateQueries` explícita | UI pode mostrar dado stale |
| **AUDIT-017** | ErrorBoundary único global | Crash em página derruba app inteiro até navegação. Adicionar por rota |
| **AUDIT-018** | Hooks gigantes `useFinanceiro.ts` 947 LOC + `useFinanceiroClientes.ts` 891 | Quebrar em hooks menores e memoizar |
| **AUDIT-019** | Cobertura `<Label>` em forms = 40% (144 labels / 367 inputs) | Compromete screen readers |
| **AUDIT-020** | 2 `console.log` ativos em prod | `TerceirizacaoPublicaView.tsx:1140` + `PropostaComercialNova.tsx:325` |
| **AUDIT-021** | Hook órfão `useSidebarCounts.ts` | Não importado em lugar nenhum. Dead code |
| **AUDIT-022** | TODOs do Thales pendentes em `AutoridadeBlocks.tsx:17,356` | Números/depoimentos reais |
| **AUDIT-023** | Skeletons faltam em `Cartao.tsx` + `CartaoDetalhe.tsx` | Inconsistente com resto do app |
| **AUDIT-024** | 2 `<img>` sem `alt` | `ContractPreviewModal.tsx:59`, `PortfolioPublico.tsx:232` |

### Backend / Edges

| # | Achado | Detalhe |
|---|---|---|
| **AUDIT-025** | 8 de 11 edges sem timeout em fetch externo | Asaas, Trello, PDFShift, Google Docs. Pode travar wall-time 400s |
| **AUDIT-026** | Trello webhook retorna 200 em HMAC inválido | Mascara incidentes. Trello considera entregue, nunca retenta |
| **AUDIT-027** | DEBUG MODE Trello vazando hash prefixes em log | Comentário marca "29/05" — reverter após validação. **Já feito hoje** |
| **AUDIT-028** | RPCs `mark_cobranca_visualizada` e `calcular_vencimento` sem SQL no repo | Criadas via Dashboard direto. Risco: deletadas em refactor |
| **AUDIT-029** | 71/90 SQLs sem transação BEGIN/ROLLBACK | Se algo falha no meio, fica inconsistente |
| **AUDIT-030** | 49 `console.log` distribuídos em edges (asaas-webhook lidera com 22) | Ruído nos logs |
| **AUDIT-031** | 108 `any` types em edges | `asaas-webhook` (22) e `gerar-proposta-msa-pdf-FULL` (14) lideram |
| **AUDIT-032** | CORS inline duplicado em `asaas-cancelar-cobranca` | Não usa `_shared/cors.ts` |

### Schema

| # | Achado | Detalhe |
|---|---|---|
| **AUDIT-033** | 14 policies `auth_rls_initplan` re-avaliam `auth.uid()` por linha | Wrap com `(SELECT auth.uid())` pra cair em InitPlan |
| **AUDIT-034** | 3 policies múltiplas/permissivas no mesmo SELECT | `empresas_config`, `financeiro_auditoria`, `profiles`. Consolidar |
| **AUDIT-035** | 3 indexes duplicados | clientes, cobrancas, orcamentos. Drop 1 de cada |
| **AUDIT-036** | 17 FKs sem index | Lento em DELETE/JOIN. Maior impacto: `asaas_webhook_events(cobranca_id)`, `cobrancas(created_by)`, `notificacoes(orcamento_id)` |
| **AUDIT-037** | 3 backup tables sem PK (de 20/04, 39 dias) | `backup_extratos_*`, `backup_lancamentos_*`, `backup_valores_adicionais_*`. Janela rollback passou. Dropar |
| **AUDIT-038** | 41 unused indexes | Custo manutenção baixo em prod pequena. Manter por agora |
| **AUDIT-039** | `login_history` cresce ~2.6k/mês | Política retenção 90 dias via cron |
| **AUDIT-040** | Cobranças com `lancamento_ids` inválidos (11) | Ver AUDIT-009 |
| **AUDIT-041** | `tarefas` e `notificacoes` com policies `TO public` | Deveria ser `TO authenticated` |

### Segurança Adicional

| # | Achado | Detalhe |
|---|---|---|
| **AUDIT-042** | `dangerouslySetInnerHTML` na proposta pública sem config DOMPurify | Tags ricas permitidas (a, img, svg, style). Master pode injetar markup pra alterar visual da proposta. Risk tampering social |
| **AUDIT-043** | 2 PDFs interpolam dados sem escape | `relatorio-status-pdf.ts:39,56` + `relatorio-prepago-pdf.ts:51,65,122`. Razão social com `<script>` executa antes de virar canvas |
| **AUDIT-044** | `portfolio_share_token` legado aceita UUID empresa_id | Comentário 17/05 dizia "remover 30 dias". Já passou 12. Ex-funcionário acessa catálogo |
| **AUDIT-045** | Rota `/tarefas` sem `RequirePermission` | Vendedor/estagiário vê todas tarefas da empresa |
| **AUDIT-046** | `MASTER_PASSWORD` env como fallback ainda ativo | Plaintext em env vaza mais fácil que dump pgcrypto. Verificar se hash já set |
| **AUDIT-047** | `cobranca-pdf` nunca expira token mesmo após pagamento | Email antigo vaza extrato (CPF, valores, descrição) permanentemente |
| **AUDIT-048** | Asaas webhook CORS `*` (mas server-to-server, OK) | Documentar como aceito |

---

## ✅ JÁ FUNCIONANDO BEM (sem ação)

- **Lazy routes**: 34 páginas todas com `lazy(import)`. Bundle otimizado
- **AuthContext sólido**
- **Asaas integrado fim-a-fim**: HMAC + idempotência + customer match + clamp dueDate (fix hoje)
- **CORS allowlist `_shared/cors.ts`** em quase todas edges públicas
- **RLS DELETE permissiva por tenant** (decisão 18/05)
- **Rate limit `verify-master-password`** (5/h user, 10/h IP)
- **WhatsApp links**: `encodeURIComponent` em todos pontos
- **PDFs contrato/extrato**: `esc()` correto
- **CPF/CNPJ não vaza em logs Asaas**
- **Service role nunca em `src/`**
- **`SUPABASE_PUBLISHABLE_KEY`** é o novo sb_publishable_* (anon key correta)

---

## 📊 Sumário numérico

| Severidade | Quantidade |
|---|---|
| Crítico | 12 |
| Médio | 30 |
| Baixo | 6 |
| **Total achados** | **48** |

Tarefas correspondentes inseridas na tabela `tarefas` com prefixo `[AUDIT-XXX]`.

---

## 🎯 Ordem sugerida de ataque

### Onda 1 — Segurança crítica (~3-4h)
1. AUDIT-001 a 006: auth em 6 edges abertas
2. AUDIT-007 + 008: RLS `cobrancas_auditoria` + `processos_zombies`
3. AUDIT-009: reconciliar 11 cobranças com lancamento_id órfão
4. AUDIT-046: remover fallback `MASTER_PASSWORD` env

### Onda 2 — Source-of-truth (~2h)
5. AUDIT-010: versionar 4 edges em prod ausentes no repo
6. AUDIT-011: consolidar 8+ versões `get_proposta_por_token` num SQL canônico
7. AUDIT-012: dropar `gerar-proposta-msa-pdf-index.ts` antigo

### Onda 3 — Hardening (~3h)
8. AUDIT-013: quebrar 3 componentes monstro (priorizar ClienteDetalhe.tsx 2734 LOC)
9. AUDIT-025: timeout AbortController em fetch externo nas 8 edges
10. AUDIT-026: webhook Trello responder 401 em HMAC inválido (vs 200 atual)

### Onda 4 — Qualidade (1 turno)
11. AUDIT-014 a 024: várias do frontend (as any, dialog, hooks, skeleton, alt, console.log)
12. AUDIT-033 a 041: schema cleanup (initplan, duplicate indexes, FKs sem index, backups)
13. AUDIT-042 a 048: segurança adicional

---

Doc gerado por: auditoria multi-agente (4 frentes paralelas)
Próximo doc: registrar progresso por onda em `auditoria-2026-05-29-progresso.md`
