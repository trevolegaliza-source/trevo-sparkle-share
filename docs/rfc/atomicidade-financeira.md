# RFC — Atomicidade Financeira

**Autor:** Claude (sessão noturna 12/05/2026)
**Status:** Proposta — aguarda decisão Thales
**Prioridade:** 🔴 Bombas reais de dado quebrado em produção

---

## Problema

5 fluxos financeiros críticos hoje fazem **N escritas em sequência sem rollback**. Se qualquer await intermediário falhar, parte das mudanças fica persistida e o resto não. UI mente "sucesso" e o operador (Letícia, master) só descobre na conciliação manual — semanas depois.

| Fluxo | Local | Pontos sem rollback | Risco real |
|---|---|---|---|
| **Gerar extrato + cobrança** | `ClienteAccordionFinanceiro.tsx:610-766` | 5 awaits (upload PDF → insert extrato → for-loop updates lancamento → insert cobranca) | Extrato existe sem cobrança; toast.success mente |
| **Deferimento em lote** | `DeferimentoModal.tsx:73-90` | for-loop sem rollback (1 await update processos + 1 await select + 1 await gerarFaturamentoDeferimento por processo) | 3º de 5 falha → 2 primeiros têm data_deferimento, 3 não. Toast erro genérico |
| **Bulk "Marcar pagos"** | `ContasReceberLista.tsx:88-94` | Bulk UPDATE em lancamentos com data=hoje, sem confirm, sem rollback | N lançamentos viram pagos sem janela de retrocesso |
| **Ativar Método Trevo** | `ClienteAccordionFinanceiro.tsx:515-631` | 4 awaits (fetch etiquetas → update processo → update lancamento) sem rollback | Toast "ativado" mas estado fica inconsistente |
| **Marcar pago (consolidação)** | 3 caminhos divergentes: modal RPC vs bulk vs handleDesfazerPagamento | 3 implementações, 1 sem tenant check | Bypass de tenant via bulk |

---

## Solução

5 RPCs no Postgres, cada uma transacional, idempotente quando possível, com tenant check rigoroso. O front passa a chamar 1 RPC por fluxo, com try/catch que reporta o erro real ao usuário.

A transação Postgres garante "tudo ou nada". O front fica fino: prepara payload, chama RPC, trata resposta.

### Princípios das RPCs novas

1. **`SECURITY DEFINER` + `SET search_path TO 'public'`** — padrão das RPCs já existentes do projeto (`criar_processo_com_lancamento`, `marcar_processo_pago`, `marcar_deferimento`).
2. **Tenant check via `get_empresa_id()`** — função já existente no banco. Toda RPC valida que o caller pertence à empresa dos dados que ele tenta mexer.
3. **Idempotência onde aplicável** — segundo clique não duplica.
4. **Anti-rebaixamento de `honorario_pago`/`cobranca_enviada`** — segue padrão DERMAE de 07/05/2026.
5. **Return JSONB** com `ok`, IDs criados e contagem afetada — pro front mostrar mensagem útil.

---

## RPCs propostas

### 1. `gerar_extrato_completo(p_payload jsonb)` — substitui REL-014

**Recebe:** payload com `cliente_id`, `processo_ids[]`, `pdf_url`, totais (`honorarios`, `taxas`, `geral`), `competencia_mes`, `competencia_ano`, `lancamento_ids[]`, `data_vencimento_cobranca`.

**Faz em transação:**
- INSERT em `extratos`
- UPDATE em `lancamentos` (extrato_id + promove etapa pra `cobranca_gerada`, com guard anti-rebaixamento)
- INSERT em `cobrancas` (com `share_token` gerado por trigger ou função)
- Tudo dentro de `BEGIN ... EXCEPTION WHEN OTHERS THEN ROLLBACK; RAISE` que o Postgres dá grátis.

**Retorna:** `{ extrato_id, cobranca_id, share_token, lancamentos_atualizados, mensagem }`.

**Front muda:**
- `executarGeracaoExtrato` no `ClienteAccordionFinanceiro.tsx` continua fazendo upload do PDF pro Storage primeiro (RPC não pode fazer upload).
- Depois chama 1 RPC só em vez dos 5 awaits sequenciais.
- Se RPC falha, **deleta o PDF do storage** que ficou órfão (cleanup).

**SQL draft:**

```sql
CREATE OR REPLACE FUNCTION public.gerar_extrato_completo(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_cliente_id uuid;
  v_extrato_id uuid;
  v_cobranca_id uuid;
  v_share_token text;
  v_lanc_count int;
  v_processo_ids uuid[];
  v_lancamento_ids uuid[];
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  v_cliente_id     := (p_payload->>'cliente_id')::uuid;
  v_processo_ids   := ARRAY(SELECT jsonb_array_elements_text(p_payload->'processo_ids'))::uuid[];
  v_lancamento_ids := ARRAY(SELECT jsonb_array_elements_text(p_payload->'lancamento_ids'))::uuid[];

  -- Tenant check
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = v_cliente_id AND empresa_id = v_empresa_id) THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

  -- 1) INSERT extrato
  INSERT INTO public.extratos (
    cliente_id, pdf_url, filename,
    total_honorarios, total_taxas, total_geral,
    qtd_processos, processo_ids,
    competencia_mes, competencia_ano,
    status, empresa_id
  )
  VALUES (
    v_cliente_id,
    p_payload->>'pdf_url',
    p_payload->>'filename',
    (p_payload->>'total_honorarios')::numeric,
    (p_payload->>'total_taxas')::numeric,
    (p_payload->>'total_geral')::numeric,
    (p_payload->>'qtd_processos')::int,
    v_processo_ids,
    (p_payload->>'competencia_mes')::int,
    (p_payload->>'competencia_ano')::int,
    'ativo',
    v_empresa_id
  )
  RETURNING id INTO v_extrato_id;

  -- 2) Linka lancamentos ao extrato e promove etapa
  -- (guard anti-rebaixamento de honorario_pago/cobranca_enviada)
  UPDATE public.lancamentos
     SET extrato_id = v_extrato_id,
         etapa_financeiro = CASE
           WHEN etapa_financeiro IN ('honorario_pago', 'cobranca_enviada') THEN etapa_financeiro
           ELSE 'cobranca_gerada'
         END,
         updated_at = NOW()
   WHERE id = ANY(v_lancamento_ids)
     AND tipo = 'receber'
     AND empresa_id = v_empresa_id;

  GET DIAGNOSTICS v_lanc_count = ROW_COUNT;

  -- 3) INSERT cobranca
  INSERT INTO public.cobrancas (
    cliente_id, extrato_id, lancamento_ids,
    total_honorarios, total_taxas, total_geral,
    data_vencimento, status, empresa_id
  )
  VALUES (
    v_cliente_id,
    v_extrato_id,
    v_lancamento_ids,
    (p_payload->>'total_honorarios')::numeric,
    (p_payload->>'total_taxas')::numeric,
    (p_payload->>'total_geral')::numeric,
    NULLIF(p_payload->>'data_vencimento_cobranca','')::date,
    'ativa',
    v_empresa_id
  )
  RETURNING id, share_token INTO v_cobranca_id, v_share_token;

  RETURN jsonb_build_object(
    'ok', true,
    'extrato_id', v_extrato_id,
    'cobranca_id', v_cobranca_id,
    'share_token', v_share_token,
    'lancamentos_atualizados', v_lanc_count
  );
END;
$function$;

COMMENT ON FUNCTION public.gerar_extrato_completo(jsonb) IS
  'REL-014: substitui os 5 awaits sequenciais sem rollback de ClienteAccordionFinanceiro.executarGeracaoExtrato. Tudo em transação Postgres com guard anti-rebaixamento.';
```

### 2. `marcar_deferimento_em_lote(p_processos jsonb)` — substitui UX-013

**Recebe:** array de `{ processo_id, data_deferimento }`.

**Faz em transação:** loop interno PL/pgSQL chamando lógica equivalente a `marcar_deferimento` mas com tenant check global no início (e não por processo).

**Retorna:** `{ ok, processados: int, falhas: [{ id, motivo }] }`.

**Front muda:** `DeferimentoModal.handleConfirm` passa array completo numa chamada. Se nada falhar, OK. Se algum falhar, mostra alert detalhado.

```sql
CREATE OR REPLACE FUNCTION public.marcar_deferimento_em_lote(
  p_processos jsonb  -- array [{processo_id, data_deferimento}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_item jsonb;
  v_resultado jsonb;
  v_processados int := 0;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_processos) LOOP
    v_resultado := public.marcar_deferimento(
      (v_item->>'processo_id')::uuid,
      (v_item->>'data_deferimento')::date
    );
    v_processados := v_processados + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'processados', v_processados);
END;
$function$;
```

> **Nota:** `marcar_deferimento` já é atômica e idempotente. Se uma falhar dentro do loop, a transação inteira rolla back (default Postgres em function call sem savepoint). Comportamento aceitável: ou tudo passa, ou nada passa.

### 3. `ativar_metodo_trevo(p_cliente_id uuid)` — substitui UX-019

**Faz em transação:** atualiza `clientes.metodo_trevo=true`, registra movimento, etc. Implementação detalhada precisa eu ler os 4 awaits originais com calma — TODO próxima sessão.

### 4. `marcar_pago_em_lote(p_lancamento_ids uuid[], p_data_pagamento date)` — substitui UX-015 + FEAT-004

**Recebe:** array de IDs + data única.

**Faz em transação:**
- Tenant check (todos os lancamentos pertencem à empresa do caller)
- UPDATE em todos com status='pago', data_pagamento, etapa_financeiro='honorario_pago', confirmado_recebimento=true
- Atualiza processos vinculados pra etapa='finalizados'

**Retorna:** `{ ok, lancamentos_pagos, processos_finalizados }`.

**Front muda:** `ContasReceberLista.handleMarcarLote` passa por modal de confirmação **com input de data** (não mais `data=hoje` automático). Aí chama esta RPC. Os 3 caminhos existentes de "marcar pago" todos convergem pra esta RPC (consolidação FEAT-004).

```sql
CREATE OR REPLACE FUNCTION public.marcar_pago_em_lote(
  p_lancamento_ids uuid[],
  p_data_pagamento date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_count_lanc int;
  v_count_proc int;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  -- Validação multi-tenant: TODOS os lancamentos devem ser da empresa
  IF EXISTS (
    SELECT 1 FROM lancamentos
    WHERE id = ANY(p_lancamento_ids)
      AND empresa_id <> v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Algum lancamento não pertence à sua empresa';
  END IF;

  -- Marca pagos
  UPDATE public.lancamentos
     SET status = 'pago'::status_financeiro,
         etapa_financeiro = 'honorario_pago',
         data_pagamento = p_data_pagamento,
         confirmado_recebimento = true,
         updated_at = NOW()
   WHERE id = ANY(p_lancamento_ids)
     AND tipo = 'receber';
  GET DIAGNOSTICS v_count_lanc = ROW_COUNT;

  -- Promove processos vinculados
  UPDATE public.processos
     SET etapa = 'finalizados',
         updated_at = NOW()
   WHERE id IN (
     SELECT DISTINCT processo_id
       FROM public.lancamentos
      WHERE id = ANY(p_lancamento_ids)
        AND processo_id IS NOT NULL
   );
  GET DIAGNOSTICS v_count_proc = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamentos_pagos', v_count_lanc,
    'processos_finalizados', v_count_proc
  );
END;
$function$;
```

---

## Plano de rollout

Atacar em **4 sub-fases, com Publish/teste real entre cada**. Não fazer tudo num PR.

### Sub-fase 2a — REL-014 (extrato completo)
1. Rodar SQL da `gerar_extrato_completo` no Supabase Editor
2. Modificar `executarGeracaoExtrato` pra chamar RPC nova **com fallback pro fluxo antigo** se RPC retornar erro/não existir
3. Commit + Publish
4. **Teste real:** Thales gera 1 extrato em produção. Confere que extrato + cobrança aparecem. Se quebra, fallback continua funcionando.
5. Depois de 1 dia rodando bem, remove o fallback.

### Sub-fase 2b — UX-013 (deferimento lote)
1. Rodar SQL `marcar_deferimento_em_lote`
2. Modificar `DeferimentoModal.handleConfirm`
3. Commit + Publish
4. **Teste real:** marcar 2 processos deferidos em lote, ver que ambos atualizam.

### Sub-fase 2c — UX-019 (ativar Trevo)
1. Ler os 4 awaits originais com Thales acompanhando
2. Escrever RPC com lógica completa
3. Mesmo padrão

### Sub-fase 2d — UX-015 + FEAT-004 (marcar pago consolidado)
1. Rodar SQL `marcar_pago_em_lote`
2. Adicionar modal de data no bulk (não mais data=hoje)
3. Trocar os 3 caminhos pra chamar a RPC
4. Commit + Publish
5. **Teste real:** marcar 1 lançamento pago via modal, ver que processo vai pra finalizados.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| RPC nova com bug silencioso → dado corrompido | Cada sub-fase com **fallback pro fluxo antigo** no primeiro Publish. Só remove fallback depois de 24-48h sem incidente. |
| `share_token` na cobrança — pode existir trigger gerando automaticamente | Investigar ANTES de escrever a RPC. Se já tem trigger, RPC só insere e trigger preenche. Se não tem, RPC gera com `gen_random_uuid()`. |
| Storage upload do PDF roda FORA da transação | É inevitável (Postgres não pode fazer upload). Se RPC falha após upload, o front faz `storage.remove(path)` no catch — limpa o órfão. |
| Função `get_empresa_id()` retorna NULL pra usuário recém-criado sem sessão completa | Já tratado nas RPCs existentes — `RAISE EXCEPTION`. Padrão. |
| Schema dos campos da `extratos`/`cobrancas` pode ter mudado | Eu não tenho acesso ao banco. **Thales precisa rodar `\d extratos` e `\d cobrancas` antes de aprovar** — pode ter `empresa_id NOT NULL` ou colunas extras que a RPC precisa preencher. |
| Triggers existentes nessas tabelas | Investigar antes — pode haver triggers de auditoria (`_auditoria_gravar`) que mudam comportamento. |
| Rebaixar UPDATE em lote `marcar_pago_em_lote` ignora guard de etapa | Adicionado guard implícito: só promove `cobranca_gerada` → `honorario_pago` (e `solicitacao_criada` → `honorario_pago`). Lancamentos já `honorario_pago` continuam OK. |

---

## Pendências antes de implementar

Antes da Sub-fase 2a, **Thales precisa confirmar/responder**:

1. **Schema das tabelas:** rodar `\d extratos` e `\d cobrancas` e me mandar — quero ver colunas exatas, defaults, triggers, NOT NULLs.
2. **`share_token` da cobrança:** é trigger ou colum default? Como é gerado hoje?
3. **`empresa_id`:** existe em `extratos` e `cobrancas`? Se sim, RPC precisa preencher.
4. **Function `get_empresa_id()`:** comportamento exato (RAISE quando NULL? Retorna NULL?).
5. **Conflito com SEC-020 (notificação refactor):** SEC-020 mexe em `notificacoes`. Não afeta este RFC mas vale conferir ordem de prioridade.

Resposta dessas 5 perguntas em ~10min de Supabase Dashboard. Sem isso, RPC pode quebrar por NOT NULL ou conflito com trigger.

---

## Estimativa final

| Sub-fase | Esforço | Risco |
|---|---|---|
| 2a (REL-014) | 2h | médio (mas com fallback) |
| 2b (UX-013) | 1h | baixo |
| 2c (UX-019) | 1.5h | médio (precisa eu reler 4 awaits) |
| 2d (UX-015 + FEAT-004) | 2h | médio (consolida 3 caminhos) |
| Pendências de schema | 10min Thales | n/a |
| **Total** | **~6.5h** | **médio com fallbacks** |

Dividido em 4 commits/Publishes — não 1 big-bang.

---

## Próximo passo

1. Thales responde as 5 pendências de schema
2. Aprova ou pede ajuste no plano
3. Sub-fase 2a primeiro, com fallback
4. Resto sequencial conforme bate
