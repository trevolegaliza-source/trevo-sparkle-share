# Auditoria: Tela Financeiro e Componentes Filhos

**Data:** 13/05/2026 | **Arquivo:** `/src/pages/Financeiro.tsx` + componentes filhos  
**Contexto:** Bloco B finalizado (REL-014, UX-013, UX-019, UX-015, FEAT-004); DECISION-001 Fase 3 aplicada

---

## 1. LAYOUT E ABAS

### Estrutura das 3 abas principais

| Aba | Valor do `value` | Componentes | O que mostra |
|-----|------------------|------------|-------------|
| **A Fazer** | `a_fazer` | `ClientesAuditoria` + `ClientesFaturar` + "Próximas faturas" | Processos aguardando auditoria, prontos para cobrar, mensalistas sem fatura |
| **Em Andamento** | `em_andamento` | `ClientesAguardando` + `ClientesContestados` | Cobranças enviadas, contestadas; cliente esperando pagar |
| **Histórico** | `historico` | `ClientesRecebidos` + "Ranking top pagadores" + "Buscar no histórico" | Lançamentos pagos, ranking de pagadores, busca livre |

### Mapeamento legado → novo
- Linhas 34–41 (`mapLegacyTab`): Remove suporte a tabs antigas (`auditoria`, `cobrar`, `aguardando`, etc.)
- Redirect automático para aba nova mais próxima
- **Propósito:** Compatibilidade com navegação antiga via `location.state` (nenhum uso detectado em 13/05/2026)

---

## 2. BOTÕES E AÇÕES

### Aba "A Fazer"

#### Header accordion "Aguardando Auditoria" (ClientesAuditoria)
- **"Auditar Todos"** (verde, ln 299–307)  
  → RPC `auditarTodosCliente()` → Move todos lançamentos para `auditado: true` → Abre modal de contato se falta dados
- **Sorting buttons** (ln 88–112)  
  - "A-Z": ordena por nome do cliente  
  - "Deferimento primeiro": prioriza clientes `momento_faturamento = no_deferimento`

#### Dentro de cada lançamento não auditado (AuditoriaFicha)
- **"Editar Valor"** (ln 851–854) → Abre input inline para novo valor → Salva via `alterarValorLancamento()`
- **"Add Taxa"** (ln 862) → Abre `ValoresAdicionaisModal` para adicionar reembolsos
- **"Deferido ✅"** (ln 873, se `podeMarcarDeferido`) → Popover com datepicker → RPC `marcar_deferimento()`
- **"Auditar"** / **"Auditado ✅"** (ln 907) → Toggle auditoria → RPC `auditarLancamento()`
- **"Excluir"** (ln 917, master only) → Dialog confirmação → DELETE processo + lancamentos

#### Header accordion "Prontos para Cobrar"
- **"Gerar Extrato de Cobrança"** (ClientesFaturar)  
  - Abre `FinanceiroList` component que renderiza tabela com:
    - Checkbox para seleção múltipla (ln 320)
    - **"Gerar Extrato de Cobrança"** (floating action bar, ln 310)  
      → Fetch dados cliente → Gera PDF → Mostra `ModalPosExtrato`
  - Dentro de cada processo selecionado:
    - **"Marcar como Faturado"** (após gerar extrato, ln 427)  
      → Update `etapa_financeiro = cobranca_gerada`

#### "Próximas faturas" accordion
- Info-only: mostra clientes com faturas agendadas  
- Não contém botões, apenas preview

---

### Aba "Em Andamento"

#### "Aguardando Pagamento" (ClientesAguardando)
Para cada cliente com cobrança enviada:
- **Checkbox por lançamento** (ln 1604) → Seleciona para "Marcar como Pago"
- **WhatsApp** → Abre chat com mensagem pré-formatada (link cobrança)
- **"Ver cobrança"** → Abre `DetalhesCobrancaModal` (se tem cobranca_id ativo)
- **"Copiar Link"** → Copia URL pública do extrato
- **"Compartilhar"** → Via Web Share API ou download PDF
- **"Copiar WhatsApp" / "Reenviar Cobrança"** → Monta mensagem + copy
- **"Baixar"** → Download PDF do extrato
- **"Marcar como Pago"** (verde) → Dialog data pagamento → Confirma → RPC `confirmarPagamento()`
- **"Contestar"** (se 1 selecionado) → Abre dialog motivo + anexo

#### "Contestados" (ClientesContestados)
- Mostra lançamentos disputados pelo cliente
- **"Resolver Contestação"** → Admin resolve, lança fica em status tratado

---

### Aba "Histórico"

#### "Pagos no período"
Para cada cliente com pagamentos:
- **"Desfazer"** (botão amber, ln 1898) → Reverte pagamento para `etapa_financeiro = cobranca_enviada`
- **"Desfazer Todos os Pagamentos"** (ln 1910) → Batch undo via `desfazer_marcar_pago()`

#### "Top pagadores do período" (ln 802–840)
- Info-only ranking
- Mostra: cliente, total recebido, qtd lançamentos, atraso médio

#### "Buscar no histórico"
- Search box + tabela com todos lançamentos do período
- Status badges: Pago | Vencido | Pendente

---

### KPIs do topo (ln 397–459)

| KPI | Métrica | Ação ao clicar |
|-----|---------|---|
| **Faturado** | `metricas.totalFaturado` | Nenhuma (info) |
| **Cobrado** | `metricas.totalCobrado` | Jump para aba "Em Andamento" |
| **Recebido** | `metricas.totalRecebido` | Jump para aba "Histórico" |
| **Inadimplente** | `inadimplenciaCalc.total` (vencidos) | Jump para aba "Em Andamento" |
| **Resultado** | Receita - Despesas | Nenhuma (info) |

---

### Resumo do Mês (ln 462–497)
Mostra qtd clientes, processos, sem extrato, inadimplentes, aguardando auditoria, falta cobrar, falta receber.

### Projeção 30 dias (ln 499–532)
Mostra lançamentos pendentes com vencimento próximo (hoje até +30d), top 3 clientes, total previsto.

---

## 3. MODAIS

### Dialog: Confirmar Pagamento (ClientesAguardando, ln 1676–1705)
- **Aberto por:** Clique em "Marcar como Pago"
- **Campos:** Data do pagamento (date input), aviso se valor >= 3000 (dupla confirmação)
- **Ação:** `confirmarPago()` → RPC `marcar_como_pago()` → Atualiza lancamentos

### Dialog: Contestar Lançamento (ClientesAguardando, ln 1707–1813)
- **Aberto por:** Clique em "Contestar" (só se 1 lançamento selecionado)
- **Campos:** Motivo (textarea), Anexo (PDF/PNG/JPG, max 5MB)
- **Ação:** Upload para Storage → RPC `contestarLancamento.mutate()`

### Modal: Detalhes Cobrança (DetalhesCobrancaModal)
- **Aberto por:** Clique em "Ver cobrança" em Aguardando Pagamento
- **Mostra:** Timeline da cobrança, tentativas de pagamento, status Asaas

### Modal: Valores Adicionais (ValoresAdicionaisModal)
- **Aberto por:** Clique em "Add Taxa" na auditoria, ou "Valores Adicionais" em ClientesFinanceiroTab
- **Função:** CRUD de taxas reembolsáveis por processo

### Modal: Gerar Asaas (GerarAsaasModal)
- **Aberto por:** Clique em "Gerar Boleto / PIX (Asaas)" em ModalPosExtrato
- **Função:** Integração Asaas para boleto/PIX

### Dialog: Contacto para Cobrança (ClientesAuditoria, ln 340–392)
- **Aberto por:** Clique em "Auditar" / "Auditar Todos" quando cliente sem contato financeiro
- **Campos:** Nome responsável, Telefone WhatsApp
- **Ação:** Salva em cliente → Continua auditoria

### Dialog: Contato Modal na Auditoria (ln 1707–1813)
- Permite preenchimento de dados de contato antes de auditar (fluxo de UX-013)

### Alert Dialog: Confirmar Deferimento Não Preenchido (FinanceiroList, ln 435–469)
- **Aberto por:** Tentar gerar extrato com processos não deferidos em cliente `no_deferimento`
- **Opções:** "Gerar Apenas Deferidos" | "Gerar Todos Mesmo Assim"

### Alert Dialog: Desfazer Pagamento (FinanceiroList, ln 471–491)
- **Aberto por:** Clique em "Desfazer" no dropdown de processo com status `honorario_pago`
- **Ação:** Confirma → RPC `desfazer_marcar_pago()`

### Alert Dialog: Confirmar Exclusão (ClientesAuditoria, ln 922–941)
- **Aberto por:** Clique em botão lixo (master only)
- **Ação:** DELETE CASCADE processo + lancamentos

---

## 4. FILTROS E BUSCA

| Filtro/Busca | Localização | Tipo | Aplicado a | Implementação |
|---|---|---|---|---|
| **Período presets** | Top header | Select (este_mes, mes_anterior, ultimos_3, custom) | Todas abas | `getPeriodoDates()` |
| **Custom dates** | Top header (se `custom` selecionado) | 2x date inputs | Todas abas | `customInicio` / `customFim` state |
| **"Buscar cliente..."** | Aba "A Fazer" | Text input | ClientesAuditoria, ClientesFaturar, Mensalistas | `searchAFazer` state → `matchClienteSearch()` |
| **"Buscar cliente..."** | Aba "Em Andamento" | Text input | ClientesAguardando, ClientesContestados | `searchEmAndamento` state → `matchClienteSearch()` |
| **"Buscar no histórico"** | Aba "Histórico" | Text input + datatable | Todos lançamentos pagos | `searchTodos` state → filtra `todosLancamentos` |

### Nota sobre filtros
- Busca é **free-text** (não query estruturada): nome/apelido cliente OU razão social processo
- **Sem filtros por etapa/status** em A Fazer / Em Andamento (sempre mostra tudo da aba)
- **Sem filtros por tipo de cliente** (MENSALISTA vs AVULSO) no Financeiro principal
  - Existe um `ClientesFinanceiroTab` separado com filtros (pero **não é usada em Financeiro.tsx**, vive em outra seção)

---

## 5. ACHADOS — AUDITORIA

### 🔴 BUG

#### B1: Race condition no ModalPosExtrato (ln 2060–2066)
**Problema:** Dialog impede fechar via Escape/click outside:
```tsx
onPointerDownOutside={(e) => e.preventDefault()}
onEscapeKeyDown={(e) => e.preventDefault()}
onInteractOutside={(e) => e.preventDefault()}
```
**Impacto:** Usuário fica preso se modal abre durante erro (e.g., falha RPC)  
**Fix:** Remover block se houver erro visível; fazer modal closable em falha

#### B2: Fallback legado sem retry (ClientesAuditoria, ln 533–562)
**Problema:** Se RPC `set_metodo_trevo` não existe, fluxo antiga roda **3 awaits sequenciais sem transação**:
```tsx
const procData = await fetch processos (1)
const etiquetas update (2)
const lancamentos update (3)
```
Se (2) sucede mas (3) falha, etiqueta ativada + valor não atualizado = inconsistência  
**Impacto:** Banco desincronizado se deploy parcial de UX-019  
**Fix:** Garantir RPC deployment; adicionar retry ou abort em falha

#### B3: Desfazer pagamento sem tenant check (FinanceiroList, ln 70–96)
**Problema:** Fallback antigo (ln 84–94) faz UPDATE direto sem verificar tenant:
```tsx
const { error } = await supabase
  .from('lancamentos')
  .update({ status: 'pendente' })
  .eq('processo_id', undoProcesso.id)
  .eq('status', 'pago');
```
**Impacto:** Usuário da empresa A pode reverter pagamento de empresa B (security hole se dados compartilhados)  
**Fix:** Usar sempre RPC `desfazer_marcar_pago` com tenant check; nunca fallback direto

#### B4: Upload anexo sem validação MIME (ClientesAguardando, ln 1731–1769)
**Problema:** Valida `.pdf, .png, .jpg, .jpeg` por extensão, mas não MIME type:
```tsx
accept=".pdf,.png,.jpg,.jpeg"
```
Usuário consegue upload `.png` com MIME `application/json`  
**Impacto:** Baixo (server Storage tem RLS), mas logs inconsistentes  
**Fix:** Validar `file.type` antes de upload

---

### 🟡 UX RUIM

#### U1: 3 caminhos diferentes para "Marcar Pago" (Thales: "botões duplicados")
1. **ClientesAguardando** → Button "Marcar como Pago" verde (ln 1663)
2. **ClientesRecebidos (desfazer)** → Button amber "Desfazer" → volta para Ag. Pagamento (ln 1898)
3. **FinanceiroList** → Dropdown "Marcar como Pago" no processo com `honorario_pago` (ln 2228–2231)
4. **MoverParaMenu** → Dropdown "Mover para" + "Marcar como Pago" (ln 2228)

**Problema:** 2 dropdowns + 1 button + 1 desfazer = 4 entry points, nenhum consistency  
**UX:** Usuário confunde qual clicar; "Desfazer" como reverso é OK, mas "Mover Para" redundante com button verde  
**Fix:** Remover dropdown "Mover para" em ClientesAguardando (existe MoverParaMenu line 1592); manter só button verde "Marcar Pago"

#### U2: Modal de contato (ClientesAuditoria, ln 348–391) aparece TODA VEZ que audita sem telefone
**Problema:** Se cliente sem `telefone_financeiro` e sem `nome_contato_financeiro`:
- Clica "Auditar Todos" → Modal pede dados → Salva → Continua
- Se não preenche, Skipa → Audita mesmo assim

**UX confusa:** "Telefone necessário para cobrança?" Mas permite ignorar → usuário não sabe se required ou not  
**Fix:** Modal title + descripção deixam claro: "Informações ajudam na cobrança (opcional)" → Remove confusão

#### U3: "Próximas faturas" accordion sempre colapsado, info low-value
**Problema:** Ln 651–694, card com 80% opacity, mostra clientes com fatura agendada, mas:
- Sem botão pra gerar extrato da futura fatura
- Sem data exata, só "Cobrar em X dias"
- Master bypassJanela vê ClientesFuturaFatura misturado com Cobrar (ln 643)

**UX:** Feature parece incompleta; "Próximas" implica "pra cobrar em breve" mas não dá ação  
**Fix:** Fazer acordion informativo (só leitura); remover if master bypass (mistura contexto)

#### U4: Ranking "Top pagadores" não filtrável/sortável
**Problema:** Ln 803–840, mostra top 5 sempre, sem opção expandir/filtrar por período granular  
**UX:** Usuário não consegue ver "quem pagou mais em Mar 2026?" vs "Maio 2026?" facilmente  
**Fix:** Adicionar dropdown "período" local ao ranking

#### U5: "Buscar no histórico" mistura lógica — search + datatable em mesmo accordion
**Problema:** Ln 842–859, search field DENTRO de accordion content, não no header:
```tsx
<AccordionContent>
  <TabTodos /> {/* search input aqui dentro */}
</AccordionContent>
```
Se usuário abre accordion sem intenção, vê tabela vazia; digita search, resultado surpreende  
**UX:** Campo de busca deveria estar visível sem expandir accordion  
**Fix:** Search box fora do accordion, na header da aba; accordion só expande quando usuário clica

---

### ⚫ INÚTIL (Código morto / Redundância)

#### I1: `mapLegacyTab()` (ln 34–41)
```tsx
function mapLegacyTab(tab: string): string {
  if (['auditoria', 'cobrar'].includes(tab)) return 'a_fazer';
  if (['aguardando', 'contestado', 'enviados'].includes(tab)) return 'em_andamento';
  if (['pagos', 'todos'].includes(tab)) return 'historico';
  // ...
}
```

**Status:** Nenhuma navegação detectada em May 2026 que passa `tab` em `location.state`  
**Propósito original:** Upgrade da tela antiga (< 10/2025) que tinha 6 abas → novo 3 abas  
**Resultado:** Dead code, 40 linhas inúteis  
**Fix:** DELETE função + removedor da chamada em useEffect (ln 79–82)

#### I2: `showFuturas` state (ln 77) — declarado, **nunca usado**
```tsx
const [showFuturas, setShowFuturas] = useState(false);
```
Não aparece em nenhum JSX, nenhum setter chamado  
**Fix:** DELETE

#### I3: `todosLancamentos` useMemo (ln 165–181)
```tsx
const todosLancamentos = useMemo(() => {
  const all = [];
  for (const c of clientes) {
    for (const l of c.lancamentos) {
      all.push({ ...l, cliente_nome: c.cliente_nome, cliente_apelido: c.cliente_apelido });
    }
  }
  if (searchTodos) {
    return all.filter(...); // filters
  }
  return all;
}, [clientes, searchTodos]);
```

Recalcula TODA VEZ que `searchTodos` muda (keystroke). Mesmo sem search, constrói array inteiro.  
**Impact:** Se 1000+ lançamentos, recompute é lento (imperceptível com 100)  
**Fix:** Separa em 2 memorized: (1) `flatLancamentos` só em lançamentos change, (2) `filtered` em search change

#### I4: `rankingPagadores` duplica lógica de `metricas.totalRecebido` do hook
**Problema:** Financeiro.tsx calcula (ln 272–297):
```tsx
const ranking = clientesPagos.map(c => {
  const lancsPagos = c.lancamentos.filter(l => l.status === 'pago' && l.data_pagamento);
  const total = lancsPagos.reduce(...);
  // ...
});
```

Mas `useFinanceiroClientes` hook JÁ tem `metricas.totalRecebido` (recalculado em hook).  
**UX:** "Recebido" KPI topo + "Top pagadores" bottom = 2 views do mesmo dado, diferentes granularidade (global vs por cliente)  
**Fix:** Mover ranking pro hook como `topClientes: Array<{cliente_id, total, qtd, atraso}>`

#### I5: "Enviados" accordion foi **completamente removido** (ln 718–722)
```tsx
{/* R0.1 — Accordion "Enviados" removido. Era hardcoded com 0 e
    mensagem "Nada por aqui ✨" — placeholder de feature que nunca
    foi implementada. */}
```

**Achado:** Comentário documenta remoção, mas não deletou accordion inteiro (existia linhas antigos)  
**Status:** Safe, was removed correctly in ln 718 comment

#### I6: `ClientesFinanceiroTab.tsx` — componente **inteiro não usado em Financeiro.tsx**
**Problema:** Arquivo `/src/components/financeiro/ClientesFinanceiroTab.tsx` define tab com:
- Filtro por "Auditado / Pendente"
- Filtro por "Tipo de cliente" (AVULSO_4D, MENSALISTA, PRE_PAGO)
- Tabela expansível de clientes + processos
- Estado de auditoria a nível de cliente + processo

Mas **Financeiro.tsx não importa nem renderiza este componente**. Usa `ClientesAuditoria` instead.

**Questão:** Thales quer um segundo modo de visualização de auditoria? Ou é deprecated?  
**Fix:** Se deprecated, DELETE arquivo inteiro (566 linhas). Se não, integrar ao Financeiro como tab alternativa.

#### I7: `FinanceiroList.tsx` — componente intermediário, usada só de `ClientesFaturar` (ClienteAccordionFinanceiro.tsx)
**Problema:** `FinanceiroList` (500 linhas) renderiza tabela de processos com:
- Checkbox multi-select
- "Gerar Extrato" floating bar
- "Marcar Faturado" dialog
- Undo dialog

Mas lógica **pré-gera**, **pós-extrato** já gerenciada em `ClientesFaturar` (500+ linhas).  
Resultado: 2 componentes com overlap de estado (selected, generating, lastPdfBlob, etc.)

**UX:** User nunca vê FinanceiroList isolado; é sempre dentro ClientesFaturar accordion  
**Fix:** Mesclar FinanceiroList + ClientesFaturar em uma estrutura limpa, eliminar overlap

#### I8: `ProcessoEditModal.tsx` aberto via double-click em `FinanceiroList` (ln 341, 1815–1820)
```tsx
onDoubleClick={() => { setEditProcesso(p); setEditModalOpen(true); }}
```

**Problema:** Modal permite editar processo (razão social, tipo, etapa, valor) **durante** geração de extrato  
Mas modal não salva estado no `FinanceiroList` — requer close + re-render  
**UX confusa:** Usuário double-clica, edita, fecha modal, não vê mudança em tabela (cache outdated)  
**Fix:** Remover double-click; manter só "Ver detalhes" link se realmente quer edit process

---

### 🟢 POLISH

#### P1: KPI "Inadimplente" (ln 432–446) tem 2 cores diferentes baseado em `> 0`
```tsx
{inadimplenciaCalc.total > 0 ? 'text-red-400' : 'text-muted-foreground/70'}
```

Se zero, mostra cinza — OK. Se >0, mostra vermelho — OK.  
**Polish:** Adicionar icon pequeno (⚠️) quando >0, pra dar mais weight visual

#### P2: "Resumo do Mês" card (ln 462–497) mistura responsividade
```tsx
<div className="grid grid-cols-2 gap-2 sm:flex sm:gap-6 text-left sm:text-right">
```

Mobile: 2-col grid, text-left. Desktop: flex, text-right.  
**Polish:** Ficaria melhor se mobile também tivesse 3 ou 4 cols (mais balanced)

#### P3: "Projeção 30 dias" card (ln 501–532) mostra "top 3" mas sem limite visual
```tsx
{projecao30d.top.map((t, i) => (
  <span key={i}>{t.nome} ({formatBRL(t.valor)})</span>
))}
```

Se >3 clientes no top, lista inteira renderiza inline — pode quebrar em mobile  
**Polish:** Limitar a 3, mostrar "+X mais" se houver

#### P4: Icon do "Próximas faturas" é Clock (⏰), mas ConteúdoRefresh seria melhor
Uso de `<Clock className="h-4 w-4 text-muted-foreground" />` (ln 655) não é semanticamente ideal  
**Polish:** Trocar por `<Calendar className />` ou `<ChevronRight />`

---

## 6. CONTEXTO — BLOCO B + DECISION-001

### Implementações recentes (concluídas 13/05/2026)

1. **FEAT-004** ("Marcar como Pago" unificado)
   - RPC `marcar_como_pago()` com tenant check ✅
   - RPC `desfazer_marcar_pago()` com tenant check ✅
   - Fallback antigo ainda existe (BUG B3)

2. **UX-013** ("Modal de contato pré-auditoria")
   - Dialog para preencher `telefone_financeiro` + `nome_contato_financeiro` ✅
   - Fluxo "Auditar Todos" dispara modal se falta dados ✅

3. **UX-015** ("3 caminhos de marcar pago" → consolidado)
   - Parcialmente consolidado: 1 button verde + 1 dropdown em Auditoria
   - Mas `MoverParaMenu` ainda oferece "Marcar Pago" (redundante)

4. **UX-019** ("Método Trevo atomicidade")
   - RPC `set_metodo_trevo()` com rollback ✅
   - Fallback antigo presente (B2)

5. **REL-014** ("Etapa financeiro binária")
   - Aba agora tem 3 estados: A Fazer / Em Andamento / Histórico
   - Processo pode ter `etapa_financeiro` rica (aguardando_deferimento → solicitacao_criada → cobranca_gerada → cobranca_enviada → honorario_pago)
   - Aba é "projeção" simplificada dos states

### Conhecidos (não dentro do scope desta auditoria)
- **TESTE FINANCEIRO** cliente fantasma pode aparecer em queries (dados de staging contaminar production)
- **DECISION-001 Fase 3** aplicada: `etapa_financeiro` binária para filtro UI, mas rich no BD

---

## 7. RECOMENDAÇÕES

### Priority: HIGH 🔴
1. **B3 (Desfazer sem tenant):** Remover fallback direto em FinanceiroList; usar apenas RPC
2. **B2 (RPC legado fallback):** Garantir deploy de UX-019 RPC; ou remover fallback + throw erro
3. **I1 (`mapLegacyTab`):** DELETE função (40 linhas) + useEffect call (4 linhas)
4. **U1 (3 caminhos Marcar Pago):** Decidir: dropdown "Mover Para" é útil? Se não, DELETE `MoverParaMenu` component

### Priority: MEDIUM 🟡
5. **U2 (Modal contato confuso):** Clarificar se "Telefone obrigatório" ou "Desejável"; título modal + copy
6. **U3 (Próximas faturas inúteis):** Ou implementar ação (gerar extrato futuro), ou converter a info-only + remover master bypass
7. **I3 (todosLancamentos recompute):** Separar flat + filter em 2 memos
8. **I5 (ClientesFinanceiroTab orphan):** Clarificar propósito; se deprecated, delete

### Priority: LOW 🟢
9. **B1 (Modal inescapável):** Adicionar graceful exit em erro
10. **B4 (MIME type validation):** Validar `file.type` além de `accept`
11. **I4 (Ranking duplica metricas):** Mover pro hook como computed field
12. **P1–P4:** Polish UX (colors, layout, icons)

---

## 8. SUMÁRIO

**Linhas de código principais:**
- `Financeiro.tsx`: 947 linhas
- `ClientesAuditoria.tsx`: 997 linhas
- `ClienteAccordionFinanceiro.tsx`: 2374 linhas (maior)
- `FinanceiroList.tsx`: 500 linhas
- `ClientesFinanceiroTab.tsx`: 567 linhas (orphan)

**Achados totais:**
- 🔴 Bugs: 4 (race condition, fallback, tenant check, MIME)
- 🟡 UX: 5 (botões duplicados, modal confuso, accordion baixa-value, ranking não-filter, search-in-accordion)
- ⚫ Inútil: 8 (legado mapping, unused state, recompute, orphan components, duplicate logic, dead code)
- 🟢 Polish: 4 (colors, layout, icons, responsive)

**Tema recorrente:** Thales disse "me incomoda muito, tem coisa inútil ali" — achados confirmam:
- 40 linhas `mapLegacyTab()` não usadas
- Estado `showFuturas` não usado
- `ClientesFinanceiroTab` componente inteiro orphan (566 linhas)
- `FinanceiroList` sobrelappingly com `ClientesFaturar`
- "Mover Para" dropdown redundante com "Marcar Pago" button

**Ação recomendada:** Sessão de refactor focada em I1, I2, I6, I8; depois U1 (remover MoverParaMenu).

