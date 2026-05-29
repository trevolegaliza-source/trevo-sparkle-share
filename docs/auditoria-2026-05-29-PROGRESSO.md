# PROGRESSO AUDITORIA — 29/05/2026 (sessão autônoma)

Status enquanto Thales fora: **25 dos 48 achados resolvidos** (~52%).

---

## ✅ COMPLETOS (pode ativar agora)

### Onda 1 — Segurança Crítica (9 itens)
| ID | O que foi feito | Onde está |
|---|---|---|
| AUDIT-001 | HMAC SHA-1 em trello-label-lembrete | `edge-functions-deploy/.../trello-label-lembrete/index.ts` |
| AUDIT-002 | x-internal-token em enviar-email-mensalidade | idem |
| AUDIT-003 | x-internal-token em notify-cliente-evento | idem |
| AUDIT-004 | JWT+role+subscription_ids+URL allowlist em enviar-push | idem |
| AUDIT-005 | x-internal-token em enviar-recibo-cobranca | `docs/edge/enviar-recibo-cobranca-FULL.ts` |
| AUDIT-006 | JWT+role+tenant em gerar-proposta-msa-pdf | `docs/edge/gerar-proposta-msa-pdf-FULL.ts` |
| AUDIT-007 | RLS habilitada em cobrancas_auditoria | SQL `auditoria-onda1-rls-29-05.sql` |
| AUDIT-008 | security_invoker=on em processos_zombies | idem |
| AUDIT-010 | 4 edges versionadas no repo | `docs/edge/{verify-master-password,provisionar-cliente-trello,trello-reconciliacao,trello-guard}-FULL.ts` |

### Onda 2 — Source-of-truth (5 itens)
| ID | O que foi feito | Onde está |
|---|---|---|
| AUDIT-009 | SQL reconciliação 11 cobranças órfãs | `docs/sql/audit-009-reconciliacao-cobrancas-orfas-29-05.sql` |
| AUDIT-011 | get_proposta_por_token consolidada CANONICAL | `docs/sql/audit-011-get-proposta-por-token-CANONICAL.sql` |
| AUDIT-012 | drop gerar-proposta-msa-pdf-index.ts antigo | (deletado) |
| AUDIT-028 | 3 RPCs canônicas versionadas | `docs/sql/audit-028-rpcs-canonicas-29-05.sql` |
| AUDIT-046 | Doc migrar master_password env→hash | `docs/sql/audit-046-master-password-set-hash-29-05.sql` |

### Onda 3 — Schema cleanup (8 itens)
| ID | O que foi feito |
|---|---|
| AUDIT-029 | Template SQL com transação BEGIN/COMMIT |
| AUDIT-033 | Wrap auth.uid() em (SELECT auth.uid()) - 12 policies |
| AUDIT-034 | Consolidar policies múltiplas (empresas_config + financeiro_auditoria) |
| AUDIT-035 | Drop 3 indexes duplicados |
| AUDIT-036 | 11 indexes criados em FKs sem cobertura |
| AUDIT-037 | Drop 3 backup tables expiradas (39 dias) |
| AUDIT-039 | Cron retenção 90 dias em login_history |
| AUDIT-041 | tarefas TO public → TO authenticated |

### Onda 4 — Componentes Monstro (2 de 3)
| ID | O que foi feito |
|---|---|
| AUDIT-013 #1 | TerceirizacaoPublicaView 2056 LOC → ~600 + 13 sub-componentes em `src/components/orcamentos/publico/terceirizacao/` |
| AUDIT-013 #2 | ClienteAccordionFinanceiro 2599 LOC → 15 (shim) + 14 sub-componentes em `src/components/financeiro/cliente-accordion/` |
| AUDIT-013 #3 | ClienteDetalhe 2734 LOC → AGENTE AINDA RODANDO em background |

### Onda 5 — Polimento (4 itens completos + 1 parcial)
| ID | O que foi feito |
|---|---|
| AUDIT-017 | ErrorBoundary individual em 5 rotas críticas (Cliente Detalhe, Financeiro, Dashboard Decisional, Processos Ativos, Faturamento, Contas Pagar) |
| AUDIT-020 | 2 console.log em prod removidos |
| AUDIT-021 | Hook órfão useSidebarCounts.ts deletado |
| AUDIT-023 | Skeleton em Cartao.tsx + CartaoDetalhe.tsx |
| AUDIT-025 | AbortController 10s nas 3 edges Trello |
| AUDIT-026 | trello-cards-events + trello-guard retornam 401 (era 200) |
| AUDIT-042 | DOMPurify config restrito (`sanitizeRichText`) |
| AUDIT-043 | esc() em PDFs relatorio-status + relatorio-prepago |
| AUDIT-044 | Doc explicando portfolio token legado |
| AUDIT-045 | RequirePermission em /tarefas |
| AUDIT-047 | SQL view + RPC pra expirar cobranca-pdf paga >30d |
| AUDIT-015 (6/15) | useConfirmDialog helper + aplicado em 6 arquivos (TrelloCardsPendentes, PropostasComerciais, Orcamentos×2, ContasReceberLista, GestaoUsuarios×3) |

---

## ⏳ PENDENTES — pra próxima sessão

### Críticos restantes
- **AUDIT-013 #3** ClienteDetalhe (agente rodando — vai terminar em background)

### Médios pendentes
- **AUDIT-014** — 593 `as any` em mutações (massivo, tipar progressivamente)
- **AUDIT-015** — 9 window.confirm restantes em ClientesAuditoria (precisa refactor sub-componentes)
- **AUDIT-016** — 67 mutations sem invalidateQueries (auditar caso a caso, risco alto)
- **AUDIT-018** — hooks useFinanceiro 947 LOC + useFinanceiroClientes 891 LOC
- **AUDIT-019** — cobertura Label em forms = 40%
- **AUDIT-022** — TODOs CEO em AutoridadeBlocks (depende do Thales)
- **AUDIT-024** — ✅ JÁ ESTAVA OK (falso positivo)
- **AUDIT-030** — console.log nas edges (rui mas baixa prioridade)
- **AUDIT-031** — any types em edges
- **AUDIT-032** — CORS asaas-cancelar (WONTFIX — comentário no código explica)
- **AUDIT-038** — unused indexes (adiado por design — prod pequena)
- **AUDIT-040** — cross-ref de AUDIT-009 (mesmo problema)
- **AUDIT-048** — Asaas webhook CORS * (server-to-server, documentado)

---

## 🚦 Pra ativar tudo da sessão (em ordem)

### 1. Secrets (uma vez só)
```
Supabase → Project Settings → Edge Functions → Secrets:
INTERNAL_TRIGGER_TOKEN = (openssl rand -hex 32)
```

### 2. SQLs (rodar em ordem no SQL Editor)
```bash
# 1. Tarefas no ERP
cat docs/sql/auditoria-2026-05-29-tarefas-inserir.sql | pbcopy

# 2. RLS + integridade
cat docs/sql/auditoria-onda1-rls-29-05.sql | pbcopy

# 3. Schema cleanup (indexes + drops + cron)
cat docs/sql/auditoria-onda3-schema-cleanup-29-05.sql | pbcopy

# 4. RPCs canonicas
cat docs/sql/audit-028-rpcs-canonicas-29-05.sql | pbcopy

# 5. get_proposta_por_token (substitui versões antigas)
cat docs/sql/audit-011-get-proposta-por-token-CANONICAL.sql | pbcopy

# 6. Wrap auth.uid()
cat docs/sql/audit-033-wrap-auth-uid-29-05.sql | pbcopy

# 7. Consolidar policies
cat docs/sql/audit-034-consolidar-policies-29-05.sql | pbcopy

# 8. cobranca-pdf expirar
cat docs/sql/audit-047-cobranca-pdf-expirar-29-05.sql | pbcopy

# 9. RECONCILIAÇÃO 11 COBRANÇAS (cuidado: tem 2 ações separadas — lê primeiro)
cat docs/sql/audit-009-reconciliacao-cobrancas-orfas-29-05.sql | pbcopy

# 10. master_password (instruções, não rodar direto)
cat docs/sql/audit-046-master-password-set-hash-29-05.sql | pbcopy
```

### 3. Edges (deploy no Dashboard)
Em ordem:
1. `trello-label-lembrete` (HMAC novo)
2. `enviar-email-mensalidade` (precisa INTERNAL_TRIGGER_TOKEN)
3. `notify-cliente-evento` (idem)
4. `enviar-recibo-cobranca` (idem)
5. `gerar-proposta-msa-pdf` (JWT + role + tenant)
6. `enviar-push` (BREAKING CHANGE — atualizar SQLs antes)
7. `trello-cards-events` (timeouts + 401)
8. `trello-cards-pendentes` (timeouts)
9. `trello-setup-boards` (timeouts)
10. `trello-guard` (401)

### 4. Publish Lovable
Pra ativar mudanças frontend.

---

## 📊 Numérico

| Categoria | Total | Resolvido | Pendente |
|---|---|---|---|
| Crítico | 12 | 11 | 1 (componente monstro #3 - agente rodando) |
| Médio | 30 | 12 | 18 |
| Baixo | 6 | 5 | 1 |
| **TOTAL** | **48** | **28** | **20** |

**Commits feitos**: 7 (a766404, 1a15d64, 914a642, fb668d7, 57adced, 2ff3fa5, b0840b8, d9dc028)
