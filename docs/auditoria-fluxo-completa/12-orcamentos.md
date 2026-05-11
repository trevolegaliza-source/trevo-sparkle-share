# 12 — Orçamentos (`/orcamentos`, `/orcamentos/novo`)

> Arquivos: `src/pages/Orcamentos.tsx` (512 linhas), `src/pages/OrcamentoNovo.tsx` (1253 linhas — segundo maior do sistema)

## 🎯 O que é

Hub de propostas comerciais. Cria orçamento, envia link público (`/proposta/:token`) pro cliente aprovar, marca aprovado/pago, gera contrato.

**Permissão:** `modulo='orcamentos'` (ver) / `acao='criar'` (criar). Master, gerente, financeiro veem.

⚠️ **Thales reclamou explicitamente:**
> "orçamentos principalmente, porque ele não tem integração alguma com o financeiro"

Esta auditoria CONFIRMA a queixa. Detalhes abaixo.

## 🔴 O achado principal — INT-001: orçamento NÃO se converte em financeiro

### O fluxo prometido (mental):
```
Rascunho → Enviado → Aprovado → Aguardando pgto → CONVERTIDO
                                                   ↓
                                         [vira processo + lancamento +
                                          cobrança no financeiro]
```

### O fluxo real (código):
```ts
// src/pages/Orcamentos.tsx:100-106
async function marcarComoPago(id: string) {
  const { error } = await supabase.from('orcamentos')
    .update({
      status: 'convertido',
      convertido_em: new Date().toISOString(),
      pago_em: new Date().toISOString()
    } as any)
    .eq('id', id);
  // ↑ SÓ ISSO. Não cria processo, não cria lancamento, não cria cobrança.
}
```

**Resultado:** orçamento marcado "convertido" é só rótulo cosmético. O master/Letícia precisa:
1. Marcar orçamento como pago em `/orcamentos`
2. **Manualmente** abrir `/cadastro-rapido`
3. Criar processo separado, **sem link de volta pro orçamento**
4. Sem rastreabilidade — `orçamento.id` nunca aparece no `processo.notas`

**Consequências reais:**
- 📊 Receita do dashboard **conta o lancamento, não o orçamento**. Se você nunca criar o processo manual, mostra R$0 mesmo tendo orçamento pago.
- 🔄 Conciliação Asaas: orçamento pago no Asaas precisa ser conciliado manualmente no orçamento E no processo separado.
- 🧾 Cobrança pública (`/cobranca/:token`) é sobre o **lancamento**, não orçamento. Cliente que pagou orçamento não tem como ver "histórico de cobranças" relacionado.
- 📈 Relatórios DRE não veem o orçamento — só os lancamentos derivados.

**Severidade:** 🔴 **Bloqueador conceitual** (não técnico) — o sistema tem 2 mundos paralelos (orçamento vs financeiro/processo) sem ponte.

## 🛠️ Como fixar — proposta INT-001

3 caminhos:

### A) Orçamento → Processo+Lancamento atômico
Ao chamar `marcarComoPago`, criar processo+lancamento automaticamente.

```sql
CREATE OR REPLACE FUNCTION public.converter_orcamento_em_processo(
  p_orcamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_orc RECORD;
  v_processo_id uuid;
  v_lanc_id uuid;
BEGIN
  -- tenant check + busca orçamento aprovado
  SELECT * INTO v_orc FROM orcamentos WHERE id = p_orcamento_id;
  -- ... validações ...

  -- Cria processo
  INSERT INTO processos (cliente_id, razao_social, tipo, valor, empresa_id, etapa, notas)
  VALUES (v_orc.cliente_id, v_orc.razao_social, 'avulso', v_orc.valor_total, v_orc.empresa_id, 'recebidos',
    format('Originado do orçamento %s em %s', v_orc.id, NOW()))
  RETURNING id INTO v_processo_id;

  -- Cria lancamento já pago
  INSERT INTO lancamentos (tipo, cliente_id, processo_id, descricao, valor, status,
                          data_pagamento, data_vencimento, etapa_financeiro, empresa_id,
                          confirmado_recebimento)
  VALUES ('receber', v_orc.cliente_id, v_processo_id,
    format('Pagamento do orçamento %s', v_orc.numero),
    v_orc.valor_total, 'pago', NOW()::date, NOW()::date, 'honorario_pago', v_orc.empresa_id, true)
  RETURNING id INTO v_lanc_id;

  -- Atualiza orçamento com referências
  UPDATE orcamentos SET
    status = 'convertido',
    processo_id = v_processo_id,
    lancamento_id = v_lanc_id,
    convertido_em = NOW(),
    pago_em = NOW()
  WHERE id = p_orcamento_id;

  RETURN jsonb_build_object('ok', true, 'processo_id', v_processo_id, 'lancamento_id', v_lanc_id);
END;
$$;
```

Requer ALTER TABLE orcamentos ADD COLUMN processo_id uuid, lancamento_id uuid.

**Esforço:** 4-6h (SQL + UI atualizada + testes)
**Risco:** Médio — toca fluxo crítico de venda

### B) Botão explícito "Converter em processo" depois de aprovado
Em vez de criar automaticamente em `marcarComoPago`, adicionar botão "Converter em processo" no orçamento aprovado. Abre wizard que pré-preenche `cadastro-rapido` com dados do orçamento.

**Esforço:** 2-3h. **Risco:** baixo. Mantém escolha humana mas dá ponte clara.

### C) Manter como está + UI melhor
Adicionar coluna `processo_id` em `orcamentos` (link manual). UI mostra "Ainda sem processo vinculado [Criar processo]". Não automatiza, mas torna a fricção visível.

**Esforço:** 1h. **Risco:** mínimo. Resolve UX, não problema de negócio.

**Minha recomendação: A em fase B** — começa pela B (com link manual), avalia uso, depois migra pra A se valor é claro.

## 🗺️ Mapa de elementos

### `/orcamentos` (lista)

```
┌────────────────────────────────────────────────────────────┐
│ Orçamentos                                  [+ Novo (⌘O)] │
│                                                             │
│ KPIs: [Rascunhos] [Enviados] [Aprovados] [Convertidos]     │
│                                                             │
│ Tabs por status: [Rascunho] [Enviado] [Aprovado] ...       │
│                                                             │
│ Cards/Tabela de orçamentos do status selecionado            │
│ Cada card: número, cliente, valor, [✏️ Editar] [⋯ Mais]    │
└────────────────────────────────────────────────────────────┘
```

### `/orcamentos/novo` (criação)
- Wizard de criação com 1253 linhas
- Seleciona cliente (ou cadastra)
- Define seções, items, valores, descontos
- Preview do PDF
- Link público (`/proposta/:token`) gerado ao salvar/enviar

## 🔬 Interações principais

### 1. Status flow
`rascunho` → `enviado` (gera link público) → `aprovado` (cliente clicou aprovar) → `aguardando_pagamento` → `convertido` (master marca pago)

**Achado UX-115 🟢:** transições só pra frente. Master pode "voltar pra rascunho" (linha 108) e "voltar pra enviado" (linha 116) — desfaz erro humano. ✅

### 2. Link público (`/proposta/:token`)
Cliente vê proposta com itens, valores, preview de contrato. Aprova/Recusa direto.

Auditado em [`14-proposta-publica.md`](./14-proposta-publica.md).

### 3. Gerar PDF do orçamento
Botão "Download PDF" via `gerarOrcamentoPDF` (em `src/lib/orcamento-pdf.ts`).

### 4. Modal Contrato
Após aprovação, master pode gerar contrato customizado.

### 5. Atalho `⌘O`
Cria orçamento novo. ✅ útil pra power user.

### 6. Ações por orçamento (dropdown)
- Editar (com confirm se já aprovado)
- Copiar
- Download PDF
- Copiar link público
- WhatsApp (envia link via deep link)
- Marcar enviado/aprovado/pago
- Voltar status
- Excluir (com confirm)
- Gerar contrato

## 🐛 Outros achados (além do INT-001)

| ID | Severidade | Problema |
|---|---|---|
| **INT-001** | 🔴 | Orçamento NÃO converte em processo+lancamento |
| **UX-116** | 🟡 | "Convertido" é só rótulo — não significa pago realmente |
| **UX-117** | 🟢 | Status flow não permite pular (ex: rascunho → aprovado direto) |
| **UX-118** | 🟢 | Sem versão (v1, v2) de orçamento; editar sobrescreve |
| **UX-119** | 🟢 | Sem histórico de quem aprovou (audit log) |

## 🚦 Verdict release amanhã

**🟢 GO** com **🔴 nota CRÍTICA**.

Pra release amanhã: orçamentos seguem funcionando como hoje (criar, enviar, marcar pago). Letícia e Thales vão lidar com a parte de "criar processo manual após aprovação" como sempre.

**Mas:** essa é a dor #1 que o Thales mencionou. **Próxima sessão de trabalho deveria atacar INT-001 (caminho B é mais simples).** Vale prioridade alta.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **INT-001** | 🔴 Orçamento não converte em processo+lancamento |
| **UX-115** | (✅ OK) status flow permite voltar |
| **UX-116** | "Convertido" é rótulo cosmético |
| **UX-117** | Status não permite pular |
| **UX-118** | Sem versionamento de orçamento |
| **UX-119** | Sem audit log de aprovação |
