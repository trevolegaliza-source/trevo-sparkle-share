# ANEXO A — Permissões + RLS

> **🚨 Crítico release.** Mapa do que cada role consegue ler/escrever no banco, vias políticas RLS.

## TL;DR

| Camada | Verdict |
|---|---|
| Sistema de roles (front) | ✅ Bem desenhado (5 roles + override granular via `user_permissions`) |
| RLS na maioria das tabelas (clientes, processos, lancamentos, cobrancas, etc) | ✅ Filtro por `empresa_id = get_empresa_id()` aplicado |
| **RLS em `cartoes`, `cartao_compras`, `cartao_faturas`** | 🔴 **VULNERABILIDADE** — sem filtro `empresa_id`. Em multi-tenant qualquer authenticated vê tudo |
| **RLS em `contatos_estado`, `notas_estado`, `precos_tiers`** | 🔴 Mesmo problema — `qual='true'` global |
| Rotas no front | 🟡 `/reconciliacao-trello` sem `RequirePermission` |

**Você HOJE só tem 1 empresa (`2fa6a9bc-...`), então os vazamentos não estouram. Mas é dívida que detona no dia que adicionar outra empresa.**

---

## 🗺️ Mapa RLS por tabela (tabelas críticas auditadas)

Legenda: `🏢` = filtra por `empresa_id`, `👑` = exige role específica, `🌐` = sem filtro (público pra todo authenticated), `🔒` = self only

### Tabelas com tenant isolation correto ✅

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `clientes` | 🏢 | 🏢 | 🏢 | 🏢 |
| `processos` | 🏢 | 🏢 | 🏢 | 🏢 |
| `lancamentos` | 🏢 | 🏢 + 👑 (master/financeiro) | 🏢 + 👑 (master/financeiro) | 🏢 + 👑 (master) |
| `cobrancas` | 🏢 | 🏢 | 🏢 | 🏢 + 👑 (master) |
| `extratos` | 🏢 | 🏢 | 🏢 | 🏢 |
| `orcamentos` | 🏢 | 🏢 | 🏢 | 🏢 |
| `documentos` | 🏢 | 🏢 | 🏢 | 🏢 |
| `valores_adicionais` | 🏢 | 🏢 | 🏢 | 🏢 |
| `notificacoes` | 🏢 | 🏢 | 🏢 | 🏢 |
| `colaboradores` | 🏢 + 👑 (master/financeiro) | 🏢 + 👑 (master/financeiro) | 🏢 + 👑 (master/financeiro) | 🏢 + 👑 (master) |
| `empresas_config` | 🏢 | 👑 (master) | 👑 (master) | 👑 (master) |
| `profiles` | 🏢 | self (trigger) | 👑 (master) ou self-safe (sem mudar role/ativo/empresa) | 👑 (master) |
| `user_permissions` | 🏢 | 👑 (master) | 👑 (master) | 👑 (master) |
| `role_templates` | 🌐 read-only | 👑 (master) | 👑 (master) | 👑 (master) |

**Análise:**
- `lancamentos`: bloqueio role-level no INSERT/UPDATE é correto — secretária/visualizador não cria lancamento via UPDATE bruto.
- `colaboradores`: master + financeiro podem editar. ⚠️ Como visto em PERM-001, `financeiro` ter `colaboradores` é decisão de produto duvidosa.
- `profiles` `update_self_safe`: brilhante — permite atualizar perfil mas BLOQUEIA mudar `role`/`ativo`/`empresa_id`. Defesa em profundidade.

### 🔴 Tabelas com RLS permissivo `qual='true'`

| Tabela | Risco | Política atual |
|---|---|---|
| `cartoes` | 🔴 Alto — cartões corporativos | `ALL` com `qual='true'` |
| `cartao_compras` | 🔴 Alto — compras detalhadas | `ALL` com `qual='true'` |
| `cartao_faturas` | 🔴 Alto — faturas do cartão | `ALL` com `qual='true'` |
| `contatos_estado` | 🟡 Médio — estratégia comercial | `ALL` com `qual='true'` |
| `notas_estado` | 🟡 Médio — notas por UF | `ALL` com `qual='true'` |
| `precos_tiers` | 🟡 Médio — tabela de preços | `ALL` com `qual='true'` |
| `role_templates` | 🟢 OK | SELECT `qual='true'`, mutação só master |

**Detalhe `cartoes`:**
```sql
CREATE POLICY cartoes_authenticated_all ON cartoes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```
Qualquer authenticated lê/escreve/deleta TODOS os cartões do banco. Hoje só tem 1 cartão e 1 empresa, então não estoura — mas é arma carregada.

**SUG-PERM-008** (sugestão de fix):
```sql
DROP POLICY cartoes_authenticated_all ON cartoes;
CREATE POLICY cartoes_select ON cartoes FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());
CREATE POLICY cartoes_insert ON cartoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id() AND get_user_role() IN ('master', 'financeiro'));
CREATE POLICY cartoes_update ON cartoes FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() IN ('master', 'financeiro'))
  WITH CHECK (empresa_id = get_empresa_id() AND get_user_role() IN ('master', 'financeiro'));
CREATE POLICY cartoes_delete ON cartoes FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');
```
(Mesma estrutura pra `cartao_compras` e `cartao_faturas`.)

**Pré-requisito:** as 3 tabelas têm coluna `empresa_id`? Conferir antes de aplicar. Se não tiverem, primeiro `ALTER TABLE ... ADD COLUMN empresa_id uuid NOT NULL DEFAULT ...` + backfill.

### Outras tabelas (não auditadas em detalhe nesta passagem)

A varredura SQL retornou que 7 tabelas têm `qual='true'`. As outras 30+ tabelas no schema `public` provavelmente estão OK (filtro por `empresa_id`), mas vale auditoria detalhada em sessão própria:
- `asaas_webhook_events`, `prepago_movimentacoes`, `service_negotiations`, `despesas_recorrentes`, `proposta_eventos`, `master_password_*`, `webhook_configs`, `cliente_precos_por_tipo`, `catalogo_*`, `acessos_publicos_log`, `trello_*_logs`, `financeiro_auditoria`, `cobrancas_lancamentos`, `cobrancas_lancamentos` junction, `plano_contas`, `orcamento_pdfs`, `colaborador_avaliacoes`, `contratos`, `backup_*` (3 tabelas), `user_permissions` etc.

---

## 🎯 Plano de release amanhã

**🟢 GO** — sistema hoje funciona com 1 empresa. Os achados RLS afetam multi-tenant futuro, não a operação atual.

**🟡 Antes do release (recomendado mas não bloqueia):**
1. Avaliar PERM-001 (`financeiro` template inclui `colaboradores`) — se você ou alguma persona financeira **não** deve ver salários, remova do template
2. Avaliar PERM-002 (`operacional` sem `dashboard`) — se quiser que a secretária veja o que está pendente, adicione

**🔴 Pré-multi-tenant (próxima sessão dedicada):**
1. **SUG-PERM-008** — corrigir RLS de `cartoes`, `cartao_compras`, `cartao_faturas`
2. **SUG-PERM-009** — corrigir RLS de `contatos_estado`, `notas_estado`, `precos_tiers`
3. **SUG-PERM-010** — auditoria detalhada das demais 30+ tabelas

---

## ✅ Cenários testados mentalmente

### Cenário 1: Letícia (gerente) entra no sistema
- ✅ Vê: dashboard, processos, clientes, orçamentos, financeiro, contas a pagar, relatórios, documentos, intel. geográfica, catálogo
- ✅ Vê valores (`podeVerValores` retorna true)
- ✅ Pode criar/editar processo, cliente, lançamento, cobrança
- ❌ Não vê configurações (correto)
- ❌ Não vê colaboradores no menu (correto)
- ⚠️ Pode acessar `/reconciliacao-trello` digitando URL (gap PERM-005)
- ⚠️ Pode acessar `/cartao` (módulo `contas_pagar` no template) — vê cartões da empresa toda inclusive da outra empresa **se um dia adicionar** (gap SUG-PERM-008)

### Cenário 2: Secretária (operacional) entra no sistema
- ✅ Vê: cadastro rápido, processos, clientes, documentos, intel. geográfica, catálogo
- ✅ NÃO vê: financeiro, contas a pagar, orçamentos, colaboradores, dashboard, configurações
- ❌ NÃO vê valores monetários (`podeVerValores` retorna false — bom pra privacidade)
- ❌ NÃO pode criar lançamento via API direta (RLS bloqueia)
- ⚠️ Pode acessar `/reconciliacao-trello` digitando URL (gap PERM-005)
- ✅ NÃO pode mudar seu próprio role (RLS `profiles_update_self_safe` bloqueia)

### Cenário 3: Usuário malicioso (cenário futuro multi-tenant)
- Logado na empresa A, abre devtools, faz `supabase.from('cartoes').select('*')` — VÊ CARTÕES DA EMPRESA B. 🔴 PERM-008.
- Logado na empresa A, faz `supabase.from('contatos_estado').select('*')` — VÊ CONTATOS DA EMPRESA B.
- Tenta `supabase.from('lancamentos').select('*')` — RLS bloqueia ✅.

---

## 📝 IDs criados nesta auditoria

| ID | Severidade | Resumo |
|---|---|---|
| **PERM-001** | 🟡 | Template `financeiro` inclui `colaboradores` |
| **PERM-002** | 🟡 | Template `operacional` sem `dashboard` |
| **PERM-003** | ✅ | Validação `visualizador` OK |
| **PERM-004** | 🔴 | `usePermissions` falha silenciosa sem profile |
| **PERM-005** | 🟡 | `/reconciliacao-trello` sem `RequirePermission` |
| **PERM-006** | 🟡 | `podeVerValores` depende de wrap manual `<ValorProtegido>` |
| **PERM-008** | 🔴 | RLS de `cartoes/cartao_compras/cartao_faturas` permissivo |
| **PERM-009** | 🟡 | RLS de `contatos_estado/notas_estado/precos_tiers` permissivo |
| **PERM-010** | 🟡 | Auditoria detalhada de 30+ tabelas restantes |

Todos serão consolidados em `AUDITORIA-GROTESCA-TREVO-ERP.md` quando esta auditoria fechar.
