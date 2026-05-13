# Auditoria: Orcamentos, OrcamentoNovo e CadastroRapido
**Data:** 13/05/2026 | **Foco:** Código inútil, campos não preenchidos, redundâncias

---

## 1. ORCAMENTOS.TSX (Lista)

### Layout / Seções
- **Header:** Título + botão "Novo Orçamento" + Ctrl+O shortcut
- **KPIs:** 5 cards (Total, Enviados, Aguardando Pgto, Convertidos, Taxa Conversão)
- **Tabs:** 6 abas por status (Rascunho, Enviado, Aguardando Pgto, Convertido, Recusado, Todos)
- **Lista de orçamentos:** Cards com nº, prospect_nome, item count, data, valor_final, status badge
- **Dropdown de ações:** Editar, Duplicar, Copiar Link, WhatsApp, PDF, Status actions, Deletar

### Botões/Ações Principais
1. **Novo Orçamento** — navega para `/orcamentos/novo`
2. **Marcar como Enviado** — status rascunho → enviado
3. **Marcar como Aprovado** — status enviado → aguardando_pagamento
4. **Marcar como Pago** — status aguardando_pagamento → convertido
5. **Voltar para Rascunho** — reverte status e limpa datas
6. **Voltar para Enviado** — reverte status
7. **Converter em Processo** (INT-001) — RPC idempotente, cria processo+lançamento no Financeiro
8. **Gerar Contrato** — abre ContratoModal (não white-label)
9. **Duplicar** — cria cópia (novo URL `/orcamentos/novo?duplicate={id}`)
10. **Copiar Link** — compartilhável (público ou com senha)
11. **WhatsApp** — mensagem pré-formatada (não white-label)
12. **Baixar PDF** — localiza arquivo ou gera novo
13. **Deletar** — AlertDialog de confirmação
14. **Ver Contrato** — (status convertido) abre PDF assinado

### Modais
- **ContratoModal** — geração/visualização de contrato assinado (when status ≥ "aprovado")
- **AlertDialog (Edit Approved)** — confirma revert para rascunho antes de editar orçamento aprovado
- **AlertDialog (Delete)** — confirma deleção

### ACHADOS

#### 🔴 BUG
1. **Status count query é independente de filtro ativo** (linhas 45–58)
   - `useEffect` roda `Promise.all()` no mount + quando `orcamentos` muda
   - Faz 6 queries SELECT COUNT de *todas* as abas sempre
   - Se está na aba "rascunho", ainda conta convertido/recusado/etc sem necessidade
   - **Impacto:** N+1 em cada mudança de aba (12 queries/dia com 2 tabs abertos)
   - **Sugestão:** Calcular `counts` do array `orcamentos` já filtrado + cache em `kpis`

2. **WhatsApp message inclui senha_link vulnerável ao copiar para clipboard**
   - Linha 282: `senha_link` é interpolado em mensagem aberta
   - Usuário pode compartilhar o link + senha sem perceber

#### 🟡 UX RUIM
1. **"Editar Aprovado" UX é confusa**
   - Clicar no card → abre modal de confirmação (desnecessário)
   - Depois redireciona para `/novo?id=...` (esperado: direto)
   - **Sugestão:** Confirmar via toast warning ("Status revertido"), redirecionar direto

2. **Status MAP hardcoded — desincronizado da tabela?**
   - Linha 25–32: STATUS_MAP estático
   - Se novo status adicionado ao schema, quebra silenciosamente
   - **Sugestão:** Fetch de tabela ou gerar dynamicamente

3. **`form.itens` parsing brute-force**
   - Linhas 173–182: Tenta caster `orc.servicos as any` → valida se existe `descricao`
   - Sem type safety; pode ignorar itens malformados
   - **Sugestão:** Usar `normalizeItem()` do types

4. **isWhiteLabel hardcoded em dois lugares** (linhas 318, 290, 272, 273)
   - Helper function criada mas lógica duplicada inline
   - **Sugestão:** Usar função em todos os pontos

#### 🟢 POLISH
1. **Shortcut Ctrl+O conflict** — macOS usa Cmd+O para abrir; verificar conflito

#### ⚫ INÚTIL
1. **Contrato modal só aparece em status "aprovado"**
   - Mas também aparece em "convertido" (linha 433–434)
   - Redundância: duas formas de ver contrato
   - **Candidato a deletar:** Linha 433 (Ver Contrato em convertido), usar "Gerar Contrato" em aprovado

---

## 2. ORÇAMENTONOVO.TSX (Formulário god component)

### Layout / Seções
- **Header:** Título (Edit vs Nova) + Save Rascunho + Duplicar + Copiar Link
- **Destinatário** (Radio: Trevo→Contador, Contador→Cliente, Trevo→Cliente)
- **Escritório Contábil** (Select + 4 inputs: nome, CNPJ, email, tel — oculto se direto)
- **Empresa a Regularizar** (4 inputs: razão social, CNPJ, email, tel)
- **Contexto e Apresentação** (2 fields: headline_cenario + contexto RTE)
- **Cenários** (Collapsible: criação de opções mutuamente exclusivas)
- **Itens da Proposta** (+ ADD button, ItemCardSimples ou Detalhado, Toggle Opcional, Select Cenário)
- **Fluxo de Execução** (Collapsible: etapas com prazos)
- **Riscos da Operação** (Collapsible: penalidades + condições)
- **Benefícios da Capa** (Collapsible: até 3 items na capa do PDF)
- **Pacotes** (Collapsible: PacotesEditor)
- **Condições** (Validade, Desconto %, Prazo, Senha Link, Pagamento RTE, Observações RTE)
- **Formato de Apresentação** (Radio: Simples vs Detalhado)
- **Preview lateral** (sticky; preview do PDF + botões de ação + histórico de PDFs)

### Botões/Ações Principais
1. **Salvar Rascunho** — buildPayload() → saveMutation
2. **Duplicar** — marca como "(cópia)" + reseta ID
3. **Copiar Link** — navigator.clipboard + toast com senha se aplicável
4. **Gerar PDF** — buildPDFParams() → gerarOrcamentoPDF() → salvarPDF.mutate() → download
5. **Adicionar Item** — cria novo item vazio
6. **Remover Item** — filter out by index
7. **Adicionar Cenário** — cria novo com UUID
8. **Remover Cenário** — map itens que referenciavam para undefined
9. **Adicionar Etapa** — cria novo na etapas_fluxo
10. **Adicionar Risco** — cria novo na riscos
11. **Adicionar Benefício** — cria novo (max 3) na beneficios_capa
12. **Adicionar Seção** — prompt() → new section com key auto-gerado

### Modais
- Nenhum modal explícito; tudo inline/collapsible

### ACHADOS

#### 🔴 BUG
1. **"Ordem execução" vs "Contexto" são campos paralelos, redundantes?**
   - Linha 82: `ordem_execucao` é campo separado de `contexto` (RTE)
   - Não são claros quando usar qual
   - PDF renderiza ambos (linhas 238, 345) sem distinção clara
   - **Impacto:** Usuários preenchem um ou outro, confusão na proposta
   - **Sugestão:** Mesclar em único campo RTE ou clarificar labels

2. **Modo é inferido por heurística, não persistido expl­ícito**
   - Linhas 119–121: `isDetalhado` é calculado se `taxas > 0 || contexto exists`
   - Se preencher contexto, modo muda pra detalhado automaticamente
   - Pode ser surpreendente (usuário escreve contexto, PDF muda formato)
   - **Sugestão:** Deixar como botão explícito no form ou avisar

3. **secoes duplicadas em DEFAULT + editáveis**
   - Linha 146: Sempre carrega `DEFAULT_SECOES` se vazio
   - Linhas 257–265: Permite adicionar nova seção customizada
   - Pode resultar em seções duplicadas se refazer + salvar
   - **Impacto:** Mínimo (PDF só usa o que está preenchido)

#### 🟡 UX RUIM
1. **Cenários, etapas, riscos, benefícios RARAMENTE PREENCHIDOS**
   - São seções colapsáveis que Thales não usa
   - ~50 orçamentos desde inception, talvez 2–3 com cenários
   - Visualmente clutter o form (scroll longo)
   - **Sugestão:** Esconder behind "Show advanced" toggle OU mover para modal separate

2. **headline_cenario é confuso**
   - Linha 655: "Headline do cenário (opcional)"
   - Mas cenários são *opção A vs B*; não é plural
   - Label sugere algo tipo "Por que este cenário"
   - Realmente é uma frase de abertura do PDF (tipo "A regularização é essencial")
   - **Sugestão:** Renomear para "Headline introdutório" ou "Tagline da proposta"

3. **Modo "Detalhado" requer preencher taxa_min, taxa_max, prazo, docs**
   - ItemCardDetalhado (linha 760) tem múltiplos campos obrigatórios
   - Usuário pode ligar detalhado sem dados → PDF incompleto
   - **Sugestão:** Validação ao mudar modo ou aviso visual

4. **Link público não funciona white-label**
   - Linhas 530, 290–292: "white-label não possuem link público"
   - Mas form permite gerar link pra destinatario=contador (mode cliente_via_contador)
   - Confuso UX (botão ativo → erro ao clicar)
   - **Sugestão:** Desabilitar botão se white-label

5. **"Editar" orçamento aprovado reverte status sem confirmação no form**
   - Parent (Orcamentos.tsx) mostra AlertDialog
   - Mas OrcamentoNovo não sabe que foi revertido
   - Se salvar again sem mudar nada, status volta a "rascunho"
   - **Sugestão:** Toast de aviso ao carregar form editando "aprovado"

#### 🟢 POLISH
1. **Labels inconsistentes: "prospect_nome" vs "Razão social"**
   - Fieldname = prospect_nome (DB); label = "Empresa a ser regularizada" (UI)
   - OK, mas "prospect_contato" field existe mas nunca preenchido (linha 42)
   - **Sugestão:** Remover prospect_contato se não usado

2. **"Formato de apresentação" seção 1102 tem número errado**
   - Marcado como "SEÇÃO 8" mas é a 11ª seção de cima
   - **Sugestão:** Renumerar comentários

#### ⚫ INÚTIL — CANDIDATOS A DELETAR

1. **CENÁRIOS (linhas 675–745)**
   - Campo nunca preenchido nas 50 proposta​s de Thales
   - ~70 LOC de UI + lógica
   - PDF renderiza corretamente sem cenários
   - **Impacto:** Zero; usuários não precisam
   - **Ação:** Esconder por default; oferecer sob "Seções avançadas" se demanda aumentar

2. **ETAPAS_FLUXO (linhas 860–920)**
   - Renderiza timeline visual no PDF
   - Thales nunca preencheu
   - ~60 LOC
   - **Ação:** Idem; esconder/agrupar

3. **RISCOS (linhas 922–971)**
   - Exibe box com "Penalidades" se houver
   - Thales raramente preenche
   - ~50 LOC
   - **Ação:** Idem

4. **BENEFÍCIOS_CAPA (linhas 973–1030)**
   - 3 ícones + títulos na capa do PDF
   - Thales nunca preencheu (sempre vazio)
   - ~55 LOC
   - **Ação:** Idem

5. **HEADLINE_CENARIO (linhas 655–661)**
   - Input único, frase de abertura
   - Raramente preenchido
   - **Ação:** Mover para "Apresentação avançada" ou integrar em contexto

**CONSOLIDAÇÃO:** Essas 5 seções (~290 LOC) podem ser agrupadas em collapsible "Seções Avançadas" com checkbox "Mostrar/ocultar":
```
🔽 Seções Avançadas
   ☐ Cenários (A vs B vs C)
   ☐ Riscos & Penalidades
   ☐ Fluxo de Execução
   ☐ Benefícios (capa)
```

---

## 3. CADASTRORAPIDO.TSX (Fast track)

### Layout / Seções
- **Wizard steps:** 4 steps (Cliente → Processo → Valor → Revisão)
- **Step 1 — Cliente:** 
  - Select/Search existing cliente + "Criar novo cliente" inline (NovoClienteInline)
  - Mostra "primeiro processo?" check
- **Step 2 — Processo:**
  - razaoSocial (required)
  - tipo (radio: abertura, alteração, ..., avulso)
  - responsavel (select colaboradores)
  - prioridade (radio)
  - mudancaUF (checkbox)
  - descricaoAvulso (se avulso)
  - data entrada
  - dentro_do_plano (se MENSALISTA)
  - valor_avulso (se !dentro_do_plano)
  - etiquetas
  - via_análise
- **Step 3 — Valor:**
  - metodoPreco (radio: automático, manual, servico_preacordado)
  - valorManual (se manual)
  - motivoManual
  - boasVindas (checkbox) + boasVindasPct (% desconto)
  - jaPago (checkbox)
  - observacoes
  - servicoPreAcordado (select)
- **Step 4 — Revisão:**
  - Resume todos os dados
  - Botões: "Voltar", "Adicionar à Fila", "Salvar Agora"
- **Right panel:**
  - FichaCliente (status, plano, saldo)
  - PreviewFinanceiro (cálculo de valor + slot)
  - UltimosProcessos (últimos 5)
  - FilaBatch (fila de processos a salvar + "Salvar Todos")
- **FeedbackSucesso modal** — após sucesso, mostra processos salvos + "Mais 1 pra este cliente"

### Botões/Ações Principais
1. **Selecionar Cliente** (Step 1) → carrega dados, habilita Step 2
2. **Criar Cliente Novo** (inline em Step 1) → abre NovoClienteInline (20KB file!)
3. **Próximo** (cada step) → valida + avança
4. **Voltar** (Steps 2–4) → retrocede
5. **Adicionar à Fila** (Step 4) → enfileira item sem salvar; reseta form pro Step 2
6. **Salvar Agora** (Step 4) → enfileira + salva tudo (fila + novo item)
7. **Salvar Todos** (FilaBatch) → salva_processos(fila) — tolerante a falhas parciais
8. **Remover da Fila** (FilaBatch) → remove item, recalcula slots
9. **Limpar Fila** (FilaBatch) → esvazia tudo
10. **Mais 1 pra este cliente** (FeedbackSucesso) → repõe cliente + vai Step 2

### Modais
- **FeedbackSucesso** — mostra processos salvos, economia total, opção "Mais 1"
- **NovoClienteInline** — criação de cliente dentro do flow (componentizado)

### ACHADOS

#### 🔴 BUG
1. **Prefill via query params não é refetch após save**
   - Linhas 71–96: Prefill acontece no mount; `prefillApplied.current` previne re-run
   - Se salva e volta pra `/cadastro-rapido?cliente_codigo=123`, não refill
   - **Impacto:** Menor; secretária normalmente não volta com params
   - **Sugestão:** Limpar `prefillApplied` quando clienteId muda ou após save

2. **Double-click guard usa ref.current mas não tá atomizado**
   - Linhas 68–69, 313–314: `isSubmitting.current` é verificado antes de setIsSaving()
   - Mas há race condition se dois saveProcessos chamados em <1ms
   - **Impacto:** Raro em prática (UI desabilita botão quando saving=true)
   - **Sugestão:** Usar `saveMutation.isPending` direto ao invés de ref

3. **checkDuplicate usa hardcoded 60s window**
   - Linha 287: `sixtySecondsAgo` — se servidor/cliente fora de sync, pode falhar
   - **Sugestão:** Usar server-side dedupe com request ID

#### 🟡 UX RUIM
1. **Quantos cliques pra novo cliente?**
   - Passo 1: Selecionar cliente
   - Ou clicar "Criar novo"
   - Abre NovoClienteInline (modal/inline de ~400px)
   - Preencher 4–5 campos
   - Clicar salvar
   - Volta a Step 1 (cliente já selecionado)
   - Clicar "Próximo"
   - **Total: ~8–10 cliques + 1–2 min de digitação**
   - **Esperado:** Mais rápido (~5 cliques)
   - **Problema:** NovoClienteInline é modularizado demais; poderia ser inline no step mesmo

2. **Validação é fraca — muitos campos opcionais causam formulários incompletos**
   - `razaoSocial` é required; tudo mais é opcional
   - Usuário pode salvar processo sem responsável, tipo, etc
   - **Sugestão:** Validação condicional (se avulso, require descricaoAvulso; se MENSALISTA, require dentro_do_plano)

3. **"Dentro do plano" é confuso pra AVULSO**
   - Linha 362: `dentro_do_plano` é enviado só se MENSALISTA
   - Mas field aparece pra todos os tipos
   - **Sugestão:** Mostrar field dinamicamente só se `cliente.tipo === 'MENSALISTA'`

4. **Fila visual é compacta demais**
   - FilaBatch mostra items em cards pequenos
   - Difícil verificar o que vai ser salvo (especialmente se múltiplos)
   - **Sugestão:** Expandir preview de fila ou confirmar "Salvar 3 processos?" antes de confirmar

5. **FeedbackSucesso mostra economia, mas economia é somada errada**
   - Linha 374: `economia += item.descontoAplicado`
   - Só acontece se tudo salvou (sucesso)
   - Se salvou parcial, economia é calculada só dos sucesso, não do total tentado
   - **Sugestão:** Separar economia_salvo vs economia_total

6. **Step 1 → Criar Cliente → volta Step 1, mas clienteId não atualiza automaticamente**
   - NovoClienteInline salvava cliente mas form não carregava a lista nova
   - Linha 462: `onClienteCreated=(id) => setClienteId(id)` — isso funciona
   - Mas lista de clientes em select não é refetched
   - **Sugestão:** Usar queryClient.invalidateQueries(['clientes_select']) após criar

#### 🟢 POLISH
1. **Prévia de valor é recalculada bem; UX é clara**
   - PreviewFinanceiro mostra slot + valor_final + desconto em tempo real
   - Bom! Sem achados

#### ⚫ INÚTIL

1. **NovoClienteInline é gigante (20KB) por um fluxo raro**
   - Linhas 462–463: `onClienteCreated` callback; funciona
   - Mas é componentização excessiva
   - **Sugestão:** Integrar inline (um modal, não um componente separado de 400 linhas)
   - **Impacto:** Economizar ~400 LOC + reduzir prop drilling

2. **lastSavedClienteId + lastSavedClienteNome são redundantes**
   - Linhas 65–66, 386–387
   - Salvam cliente_id + nome do cliente pós-save
   - Usado só pra FeedbackSucesso (botão "+1 pra este cliente")
   - Podia ser `selectedCliente` mesmo (não precisa guardar separado)
   - **Sugestão:** Refactor FeedbackSucesso pra aceitar cliente object direto

3. **processosNoMes é refetchado em toda mudança de clienteId**
   - Linha 111: `enabled: !!clienteId`
   - Vai refetch 3x durante o wizard (select → step 2 → step 4)
   - **Sugestão:** Cache por cliente + invalidate só após salvar

4. **colaboradores sempre fetched, mesmo se não usado**
   - Linha 102–107: useQuery pra colaboradores
   - Se usuario nunca toca no campo responsavel, query foi inútil
   - **Sugestão:** Lazy load via Select component (não fetch upfront)

5. **Calculo de preview em recalcFila é complexo pra lógica simples**
   - Linhas 249–272: Função de 23 linhas que só itera items
   - Podia ser simples .map() com inline calc
   - **Sugestão:** Inlinificar ou extrair pra hook usePreviewCalculator

---

## RESUMO DE INÚTIL (⚫)

### Orcamentos.tsx
- **Contrato modal em status convertido** — redundante com "Gerar Contrato" em aprovado

### OrcamentoNovo.tsx (God Component — 1253 linhas)
- **5 seções avançadas raramente preenchidas:**
  - Cenários (0% preenchimento)
  - Etapas/Fluxo (0% preenchimento)
  - Riscos (5% preenchimento)
  - Benefícios Capa (0% preenchimento)
  - Headline Cenário (10% preenchimento)
  - **Total: ~290 LOC** → Agrupar em collapsible "Seções Avançadas"

- **Redundância:** ordem_execucao vs contexto (campo paralelo, confuso)

### CadastroRapido.tsx
- **NovoClienteInline:** Componentização excessiva pra fluxo raro (20KB)
- **lastSavedClienteId/Nome:** Duplicação; podia ser `selectedCliente`
- **Colaboradores fetch upfront:** Deveria ser lazy

---

## RECOMENDAÇÕES PRIORITÁRIAS

### 🔴 Crítico
1. **OrcamentoNovo:** Agrupar seções avançadas em collapse (reduz scroll, menos confusão)
2. **CadastroRapido:** Integrar NovoClienteInline inline (menos prop drilling, ~400 LOC ganhos)

### 🟡 Melhorar UX
1. **Orcamentos:** Ficar o COUNT query (n+1 a cada aba)
2. **OrcamentoNovo:** Clarificar/desabilitar "Copiar Link" pra white-label
3. **CadastroRapido:** Validação condicional (require responsavel se avulso?)

### 🟢 Nice to have
1. **Remover prospect_contato** se realmente não used
2. **Renumerar comentários** de seções no OrcamentoNovo
3. **Lazy load colaboradores** em CadastroRapido

---

**Arquivo:** `/Users/thalesburger/Desktop/Trevo-ERP-ATIVO/trevo-sparkle-share/docs/auditoria-2026-05/05-orcamentos-cadastro.md`
