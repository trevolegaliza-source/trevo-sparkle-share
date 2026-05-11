# ANEXO B — Saúde do banco

> Varredura programática de anomalias de dado. Read-only via MCP.

## TL;DR

| Categoria | Resultado |
|---|---|
| Processos sem cliente | ✅ 0 |
| Processos com etapa inválida (`'concluido'`) | 🟡 2 (PERANOVICH & MACEDO + SEPI) |
| Lançamentos órfãos (sem processo/cliente válido) | ✅ 0 |
| Lançamentos "fantasma" (status=pago, confirmado=false) | 🟢 37 — **TODOS contas a pagar, comportamento ESPERADO** |
| Inconsistências `cobrancas.lancamento_ids` vs `cobrancas_lancamentos` | ✅ 0 |
| Tabelas backup esquecidas | 🟡 3 tabelas com 329 registros |
| Sentinela `processos_zombies` (view MON-001) | ✅ vazia |

**Saúde geral: 🟢 BOA.** Os "30 lançamentos fantasma" do HANDOFF eram **falso alarme** (explicação abaixo).

---

## 🔬 Detalhes por categoria

### 1. "Lançamentos fantasma" — REINTERPRETADOS

**HANDOFF débito #2** afirmava:
> Existem 30 lancamentos com status='pago', confirmado_recebimento=false, etapa_financeiro='solicitacao_criada'. Suspeita: algum botão "Marcar Pago" em outro lugar seta status=pago sem mexer em confirmado_recebimento.

**Investigação real:** hoje são 37 (subiu). Detalhamento:

| Tipo | Quantidade |
|---|---|
| `tipo='receber'` | **0** |
| `tipo='pagar'` | **37** |
| Com extrato gerado | 0 |
| Período | 30/03 – 08/05 |

**Conclusão:** todos são **contas a pagar marcadas pagas**. O campo `confirmado_recebimento` semanticamente **só faz sentido pra `tipo='receber'`** — pagar não tem "recebimento" a confirmar.

**Não é bug** — é **schema confuso**: a coluna `confirmado_recebimento` é shared entre os dois tipos. Em contas a pagar fica sempre `false`.

### Recomendação SUG-DATA-001
```sql
-- (opcional) Tornar `confirmado_recebimento` semanticamente claro:
-- A) Renomear (custoso, afeta queries do front)
-- OR
-- B) Adicionar check explicit:
ALTER TABLE lancamentos ADD CONSTRAINT confirmado_recebimento_so_receber
  CHECK (confirmado_recebimento IS NOT TRUE OR tipo = 'receber');
-- Bloqueia novo INSERT em pagar marcando confirmado_recebimento=true por engano.
```

**Severidade:** 🟢 nice-to-have. Não bloqueia release.

### 2. Processos em etapa `'concluido'` (inválida)

2 processos restantes com `etapa='concluido'` (valor que NÃO está em `KANBAN_STAGES`):

| Processo | Cliente | Tem lancamento? |
|---|---|---|
| PERANOVICH & MACEDO COMERCIO DE VEICULOS LTDA | ASLAN | ✅ sim (não é zombie) |
| SEPI COMERCIO DE VEICULOS LTDA | ASLAN | ✅ sim (consertado hoje DATA-005) |

A view `processos_zombies` (MON-001) **só pega quando NÃO tem lancamento** — por isso retorna 0. Esses 2 têm lancamento; aparecem com etapa inválida no banco mas a UI mostra "Concluído" via fallback.

**SUG-DATA-002:** normalizar.
```sql
-- Migra 2 processos pra etapa válida:
UPDATE processos SET etapa = 'finalizados' WHERE etapa = 'concluido';
```
**Esforço:** 1 linha SQL. **Risco:** zero. **Quando:** próxima sessão de manutenção. DECISION-001 vai resolver junto.

### 3. Lançamentos sem `cliente_id`: 166

**Detalhamento:** TODOS são `tipo='pagar'`. **Esperado** — contas a pagar (DAS, aluguel, fornecedor) não tem cliente associado.

✅ Sem ação.

### 4. Sentinela MON-001 (`processos_zombies` view)

```sql
SELECT * FROM public.processos_zombies;
-- 0 rows
```

✅ Vazia. Sentinela funcionando corretamente.

### 5. Tabelas backup esquecidas

3 tabelas no schema `public`:
- `backup_lancamentos_20260420` — 163 rows
- `backup_extratos_20260420` — 100 rows
- `backup_valores_adicionais_20260420` — 66 rows

Criadas durante Onda 6 (27/04, migração Supabase). **329 rows ocupando espaço.**

**SUG-DATA-003:** depois de N dias (60? 90?) sem usar, dropar.
```sql
DROP TABLE public.backup_lancamentos_20260420;
DROP TABLE public.backup_extratos_20260420;
DROP TABLE public.backup_valores_adicionais_20260420;
```

**Pré-requisito:** validar com Thales que dado vivo está estável (que o backup não vai ser preciso).

**Esforço:** 3 linhas. **Quando:** anote pra 90 dias após Onda 6 (final de julho).

### 6. Consistência `cobrancas.lancamento_ids` vs `cobrancas_lancamentos`

Trigger `_sync_cobranca_lancamentos_junction` (Onda 7 #10) mantém os 2 sincronizados.

Auditei: ✅ 0 inconsistências em 45 cobranças.

---

## 🚦 Verdict release amanhã

**🟢 GO.** Banco está saudável.

- "30 fantasmas" do HANDOFF eram falso alarme. **Removo do débito técnico no próximo update do HANDOFF.**
- Os 2 processos em etapa `'concluido'` não atrapalham (UI tem fallback).
- Tabelas backup não atrapalham até dropar.

## 📝 Sugestões criadas

| ID | Resumo |
|---|---|
| **SUG-DATA-001** | CHECK constraint `confirmado_recebimento` só em `tipo='receber'` |
| **SUG-DATA-002** | UPDATE 2 processos com etapa='concluido' → 'finalizados' |
| **SUG-DATA-003** | DROP TABLE backup_*_20260420 após 90 dias |
