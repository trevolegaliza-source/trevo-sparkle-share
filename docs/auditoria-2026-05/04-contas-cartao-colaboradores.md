# Auditoria: Contas a Pagar, Cartão de Crédito e Colaboradores
**Data:** 2026-05-13  
**Foco:** Telas de perfil master (ContasPagar, Cartao, CartaoDetalhe, Colaboradores) + componentes filhos relevantes

---

## 1. CARTAO (`/cartao`) — Listagem de cartões

### Layout
- **Header:** Título + botão "Novo cartão"
- **Alerta de renovação:** Card amber mostra assinaturas perto de expirar (≤2 meses)
- **Grid de cartões ativos (3 col no desktop):** Nome, bandeira, últimos 4, datas, limite, botão "Abrir fatura"
- **Seção de arquivados (details collapsible):** Compacta, com opção reabrirCartões
- **Modal de formulário:** CartaoFormModal
- **Modal de confirmação:** Arquivar cartão

### Botões/Ações Principais
- **Novo cartão** → abre CartaoFormModal (create)
- **Editar** (icon lápis) → abre CartaoFormModal (edit)
- **Arquivar** (icon arquivo) → AlertDialog confirmação + soft-delete (ativo=false)
- **Abrir fatura** (link em cada card) → Link para `/cartao/{id}`

### Modais Abertos
- `CartaoFormModal` (create/edit)
- `AlertDialog` (confirmação arquivar)

### Achados

#### 🟡 **UX ruim**
1. **Hook `useAssinaturasExpirando()`** (linhas 33-71):
   - Executa query cada time a página recarrega (staleTime=5min)
   - Lógica "última fatura de cada grupo" pode ser pesada se 100+ faturas
   - **Recomendação:** Mover para hook separado + testar com N>100 compras

2. **Falta feedback após arquivar:**
   - AlertDialog desaparece, cartão some do grid, mas **nenhum toast/notification**
   - User fica incerto se funcionou
   - **Recomendação:** Adicionar `toast.success('Cartão arquivado')`

#### 🟢 **POLISH**
1. **Data hardcoded "62 dias"** (linha 56):
   - `const dois_meses_em_dias = 62;`
   - Mais correto: `const diasAviso = 60;` ou colocar em const global
   - Muito cosmético, mas 62 é específico e sem significado óbvio

2. **Falta i18n:**
   - "Nenhum cartão cadastrado" / "expirou há" / "expira hoje" — strings em PT-BR hardcoded
   - Não crítico (UI monolíngue), mas documenta dependência de PT-BR

#### ⚫ **INÚTIL**
1. **`cartaoNomeMap` (linhas 84-88):**
   - Cria Map `id → nome` a cada render
   - **Usado:** Linha 132 em `expirando.map()` para buscar nome via `cartao_id`
   - **Problema:** Map recriado toda hora; se 50+ cartões, é lixo de memória
   - **Recomendação:** Mover para `useMemo` ou remover se usar campo `cartao.nome` direto da query
   - Nota: Query já traz `cartao_id`, falta `cartao.nome` na response?

---

## 2. CARTAO_DETALHE (`/cartao/:id`) — Fatura mensal

### Layout
- **Topo:** Link voltar + botão "Nova compra"
- **Card cabeçalho do cartão:** Mostra nome, bandeira, últimos 4, datas fechamento/vencimento
- **Navegação de fatura:** Setas ← → + mês/ano + badges (Paga, Fechada, Aberta, Pronta p/ fechar, Atual)
- **Grid de info:** Fechamento, Vencimento, Total da fatura
- **Ações condicionais:**
  - Se aberta + compras: "Fechar fatura" (lock icon)
  - Se fechada + não paga: "Reabrir fatura" (unlock icon)
  - Se paga: Mostrar "Paga em dd/mm"
- **Lista de compras:** Tabela com data, descrição, badges (parcelado, assinatura), valor, ações (editar, excluir)
- **Atalhos de meses com compras:** Buttons pra pular entre meses com lançamentos
- **Modais:** CompraFormModal, CompraEditModal, AlertDialog (fechar/reabrir/excluir)

### Botões/Ações Principais
- **Nova compra** → abre CompraFormModal
- **Editar compra** (icon lápis) → abre CompraEditModal
- **Excluir compra** (icon lixo) → AlertDialog com opções:
  - Se parcelado/assinatura: "Só esta parcela" vs "Cancelar inteira"
  - Senão: "Excluir"
- **Fechar fatura** → cria lançamento em Contas a Pagar
- **Reabrir fatura** → deleta lançamento de Contas a Pagar

### Modais Abertos
- `CompraFormModal` (create)
- `CompraEditModal` (edit)
- `AlertDialog` (fechar/reabrir/excluir compra)

### Achados

#### 🔴 **BUG**
1. **Data de fechamento calcula errado se `faturaMes` não tem dias:**
   - Linha 119: `calcularDataFechamento(dataVencFatura, cartao.dia_fechamento)`
   - `dataVencFatura = "${faturaMes}-${dia_vencimento}"` (ex: "2026-05-31")
   - Se mês tem só 30 dias mas `dia_vencimento=31`, função retorna inválido?
   - **Recomendação:** Testar casos extremos (31º em fevereiro/abril/junho/set/nov)

2. **`mesesComCompras` (linha 92-97):**
   - Agrupa por `isoToYearMonth(c.fatura_vencimento)` (field ISO string)
   - Depois filtra compras por `faturaMes` (YYYY-MM)
   - Se API retorna `fatura_vencimento=null`, quebra silenciosamente

#### 🟡 **UX ruim**
1. **"Reabrir fatura" é destrutivo mas padrão:**
   - Alerta mostra "O lançamento em Contas a Pagar será APAGADO"
   - Botão é `AlertDialogAction` (vermelho, classe destructive)
   - **OK, mas:** Muito fácil errar se click rápido; considerar 2-step confirmation ou checkbox

2. **Compra com parcelas: diálogo ambíguo**
   - Linhas 458-480: descrição muda se parcelado vs assinatura
   - "Cancelar assinatura inteira" vs "Excluir todas as parcelas" confunde
   - Se user clica "Excluir" na primeira parcela, pensa que exclui tudo
   - **Recomendação:** Renomear botão "Só esta parcela" → "Só mês #{n}"

3. **Sem feedback visual pós-ação:**
   - Fechar/reabrir/excluir compra não mostram toast
   - Usuário fica incerto se salvo
   - **Recomendação:** `toast.success()` após sucesso

#### 🟢 **POLISH**
1. **Helpers de data (linhas 40-69):**
   - `fmtBRL`, `fmtData`, `fmtMesAno`, `isoToYearMonth`, `mesAtualISO`, `navegarMes`
   - 6 funções diferentes; poderiam estar em lib/cartao-helpers
   - Não crítico (tá limpo), mas encoraja copy-paste em outros components

2. **Ordem de badges:**
   - Linhas 183-200: badges (Paga, Fechada, Aberta, Pronta p/ fechar, Atual)
   - Muita informação simultânea; considerar condensar pra 2-3 badges max

#### ⚫ **INÚTIL**
1. **`consolidada` query (linha 125):**
   - Busca `useFaturaConsolidada()` pra pegar status real + lancamento_id
   - Se fatura ainda tá aberta: `consolidada` é null ou vazio?
   - **Usado:** Linhas 126-128 (statusReal, faturaJaFechada), linha 264 (data_pagamento), linha 436 (lancamento_id)
   - **Problema:** Lógica frágil se hook retorna null; ver hook source
   - **Recomendação:** Validar resposta `if (!consolidada) return <EmptyState/>`

2. **`todasCompras` (linha 81):**
   - Busca **todas** as compras do cartão (sem filtro por mês)
   - **Usado:** Linha 92 pra calcular `mesesComCompras` (ótimo, aggregation)
   - **Mas:** Se 500+ compras históricas, carregar todas é wasteful
   - **Recomendação:** Lazy-load ou paginar histórico antigo

---

## 3. CONTAS_PAGAR (`/contas-pagar`) — Gestão de despesas

### Layout
- **Header:** Título + Month Nav (← | Maio 2026 | →) + Botões (Selecionar, Importar Folha, Nova Despesa)
- **KPIs (ContasPagarKPIs):** Total Previsto, Total Pago, Total Pendente, Total Vencido (com filter chips)
- **Dias alerta + chips filtro:** "Alertar em X dias" + Mostrar (Todas / Hoje / 7d)
- **Tabs (Visão, Lista [conditional], Recorrentes, Histórico)**
  - **Visão:** CategoriaAccordion (agrupa por categoria → subcategoria)
  - **Lista:** ContasPagarLista (tabela com search + filtros) — **só aparece quando selection mode ou KPI filtro**
  - **Recorrentes:** RecorrentesTab (tabela de despesas que repetem)
  - **Histórico:** HistoricoPagamentos (dashboard de pagamentos)
- **Provisão:** ProvisaoBarra (resumo de despesas recorrentes)
- **Bulk selection bar (fixed bottom):** Aparece qdo selection mode + itens selecionados
- **Modais:** DespesaFormModal, RecorrenteFormModal, MarcarPagoModal, ImportarFolhaModal, MarcarPagoBulkModal, AlertDialogs (delete, valor alto, edit pago, desfazer)

### Botões/Ações Principais
- **Nova Despesa** → DespesaFormModal (create)
- **Importar Folha** → ImportarFolhaModal (cria lançamentos de folha para mês)
- **Selecionar** → ativa selection mode → mostra Tab "Lista" + bulk bar
- **KPI chips (Total/Pago/Pendente/Vencido)** → filtra + abre Tab "Lista"
- **Marcar Pago** → MarcarPagoModal (input data pagamento + upload comprovante)
  - Se valor ≥ R$ 3.000: pré-confirmação de valor alto
- **Marcar Pago (Bulk)** → MarcarPagoBulkModal (N items simultaneous)
- **Editar** → DespesaFormModal (edit) — **bloqueado se já pago** (alerta + opção desfazer)
- **Desfazer pagamento** → AlertDialog (janela 24h, motivo opcional, sem histórico)
- **Excluir (bulk)** → AlertDialog confirmação
- **Geração automática de recorrentes** → Via `gerarLancamentosRecorrentes()` no useEffect
- **Auto-import folha** → Via `gerarVerbasDoMes()` no useEffect (idempotente, atualiza pendentes)

### Auto-execução (useEffect)
1. **Linha 101-116:** Gera lançamentos recorrentes se não gerados pra esse mês
2. **Linha 124-158:** Auto-importa folha (salário, VT/VR, DAS, FGTS, INSS, 13º, férias) ao abrir mês
   - Guarda hash dos campos relevantes do colaborador pra re-trigger em mudanças
3. **Linha 160-177:** Corrige datas em feriado/fim-de-semana (1-shot por sessão via flag)

### Componentes Filhos

#### CategoriaAccordion
- **Props:** lancamentos, onEdit, onMarcarPago, onPagarMerged (VT+VR juntos)
- **Estrutura:**
  - Agrupa por categoria (folha, infraestrutura, etc.)
  - Se `categoria=folha`: `FolhaSubgrupos` (agrupa por data → subcategoria → colaborador)
    - VT+VR aparecem merged em "BENEFÍCIOS" row se mesmo colaborador
    - Mostra cálculo: `VT diário × dias = total`
  - Senão: divide por linhas com info resumida (fornecedor, data)
- **Features:**
  - Icons coloridos por categoria
  - Status badges + urgência (pago/atrasado/urgente/normal)
  - Ação "Pagar VT+VR juntos" → abre bulk modal pre-selecionado (1 PIX)
  - Modal "Avisar Colaborador" post-pagamento
  - Comprovante Lightbox (modal de visualização)
  - PIX copy-to-clipboard
  - Relative dates (HOJE/AMANHÃ/EM Xd)
- **Código:**
  - **Muito complexo:** 704 linhas com subgrupos aninhados, lógica de VT/VR unificação, urgência dinâmica

#### RecorrentesTab
- **Props:** recorrentes, onNew, onEdit, onToggle, onDelete
- **Estrutura:** Tabela simples (categoria, descrição, fornecedor, valor mensal, dia venc., status, ações)
- **Ações:** Editar, Pausar/Ativar (toggle), Excluir
- **Muito simples:** 84 linhas

#### ContasPagarLista
- **Props:** lancamentos, onEdit, onMarcarPago, onDelete, selectionMode, selectedIds, onToggleSelect, kpiFilter
- **Estrutura:** Tabela com search + filtros (categoria, status)
- **Filtros:** KPI precedence > Category > Status > Search
- **Features:**
  - Checkbox na seleção (disabled se pago)
  - Badge ↻ identifica recorrentes
  - Comprovante icon (paperclip)
  - Ações: Marcar pago, Editar, Excluir
- **Código:** 235 linhas, relativamente limpo

### Achados

#### 🔴 **BUG**
1. **Auto-folha dispara infinitamente se colaborador muda**
   - Linhas 133-137: Cria `colabHash` com ID + dias + salário + updated_at
   - **Problema:** `updated_at` muda toda vez que any field é editado
   - Se user muda um campo em colaborador → hash muda → re-gera folha
   - Se gera folha → atualiza lancamentos → pode disparar update novamente?
   - **Recomendação:** Remover `updated_at` do hash; usar apenas campos que afetam verba (dia_salario, salario_base, etc.)

2. **Corrigir datas existentes sem erro handling**
   - Linhas 165-177: Chama `corrigirDatasExistentes()` 1-shot per session
   - Se falha silenciosamente (catch vazio), user não sabe que holiday-fix quebrou
   - **Recomendação:** Log ao console no catch ou mostrar toast.warning se count=0

3. **KPI filter + date filter orthogonal mas não testado**
   - Linhas 252-296: `kpiFilter` (status based) + `dateFilter` (7d/today)
   - Ambos filtram `lancamentos` em `lancamentosFiltrados`
   - Não há sync entre eles; se user seleciona "Vencido" KPI + "Hoje" date, nada aparece (correto, mas confuso UX)

#### 🟡 **UX ruim**
1. **"Marcar Pago" pra lançamento já pago confunde:**
   - Linhas 190-194: Se pago, botão muda label pra "Editar pagamento / comprovante"
   - Mas ícone segue igual (CheckCircle com cor diferente)
   - **Recomendação:** Ícone diferente (ex: Edit icon) ou tooltip

2. **Modal "Editar já pago" bloqueador:**
   - Linhas 665-694: Se click edit em pago → AlertDialog aviso
   - Oferece botão "Desfazer pagamento" (se ≤24h) ou "Editar mesmo assim"
   - **Problema:** User que quer só ver detalhes é forçado confirmar 2x
   - **Recomendação:** Abrir modal read-only se não em janela; user escolhe se editar

3. **Provisão (ProvisaoBarra) escondida no bottom:**
   - Linha 579: `<ProvisaoBarra>` aparece só ao scroll down
   - Não há call-to-action visual indicando que existe
   - **Recomendação:** Mover pra top ou adicionar badge na aba

4. **Auto-toast de lembrete irritante:**
   - Linhas 258-283: Toast "⏰ N despesa(s) vencem nos próximos X dias"
   - 1x por sessão (sessionStorage), mas muito barulho se user entra /contas-pagar várias vezes
   - **Recomendação:** Remover toast; indicador visual (badge contador na aba) é suficiente

#### 🟢 **POLISH**
1. **Hardcoded threshold R$ 3.000:**
   - Linha 191: `const VALOR_ALTO_THRESHOLD = 3000;`
   - Sem motivo aparente; deveria estar em config/settings
   - **Recomendação:** Mover pra context/store (user-configurable)

2. **Timezone handling frágil:**
   - Datas vem como ISO string (2026-05-13) sem timezone
   - Comparações usam `.split('T')[0]` e `+T12:00:00` (hardcoded noon)
   - Se timezone muda, comparações podem virar 1 dia off
   - **Recomendação:** Usar lib de datas (date-fns) com timezone support

3. **Muitas funções de formato inline:**
   - `fmt()` redefinida em vários componentes (CategoriaAccordion, RecorrentesTab, ContasPagarLista)
   - **Recomendação:** Centralizar em `/lib/format.ts`

#### ⚫ **INÚTIL**
1. **`colabMap` (linhas 74-88) sobreconstruído:**
   - Cria Map de ID → nome a cada render
   - **Usado:** Linha 86 pra enriquecer lancamentos com `colaborador_nome`
   - **Problema:** Merge de 2 queries (lancByComp + lancByDate) roda toda hora
   - **Recomendação:** Mover lógica pra hook ou query; cacheabilidade

2. **Tab "Lista" aparece/desaparece:**
   - Linhas 523-525: `{(selectionMode || kpiFilter !== 'total') && <TabsTrigger>}`
   - Quando user cancela seleção → Tab some → aba volta pra "Visão"
   - **Pode confundir:** User tá em "Lista" → clica Cancelar → vira "Visão", pensa que dados sumiram
   - **Recomendação:** Manter Tab "Lista" sempre visível, desabilitar se nada pra mostrar

3. **Modal de confirmação "valor alto" é extra**
   - Linhas 728-750: AlertDialog pré-confirmação de valor ≥ R$ 3.000
   - Abre -> clica "Sim" -> abre MarcarPagoModal
   - 2 modals = 2 cliques pra pagar 1 item
   - **Recomendação:** Integrar confirmação dentro MarcarPagoModal (warning visual, não modal)

4. **`diasAlerta` salvo em localStorage sem versioning:**
   - Linhas 251, 485: Lê/salva `trevo_dias_alerta_pagar`
   - Se format muda, stale valor quebra
   - **Recomendação:** JSON versioning ou resetar default

5. **Seção "Fluxo Próximos 15 Dias" redundante?**
   - Linha 422: `<FluxoProximos15Dias />`
   - Não sei o que mostra (não incluído na leitura)
   - Se duplica info de KPIs, é redundante

---

## 4. COLABORADORES (`/colaboradores`) — Gestão de RH

### Layout
- **Header:** Título + Botões ("Gerar Verbas do Mês", "Novo Colaborador")
- **KPIs (3 cards):** Colaboradores Ativos, Custo Total Mensal, Dias Úteis (mês atual)
- **Search bar:** "Buscar colaborador..."
- **Tabela:**
  - Colunas: Nome (com ícone 🎂 aniversariante), Regime (badge CLT/PJ/INDEFINIDO), Salário, Custo Total, PIX (copy button), Trello, Status, Ações
  - Hover: Mostra botões editar + deletar
  - Click linha → abre ColaboradorDetalheModal
- **Modais:** ColaboradorForm (create/edit), ColaboradorDetalheModal (read-only detalhes), GerarVerbasModal
- **Features:**
  - Ícone 🎂 no nome se aniversariante do mês
  - Email mostrado abaixo do nome em smaller text
  - PIX copy-to-clipboard com ícone Copy
  - Status badge (Ativo/Inativo)

### Botões/Ações Principais
- **Novo Colaborador** → Dialog com ColaboradorForm (create)
- **Gerar Verbas do Mês** → GerarVerbasModal
  - Step 1: Selecionar colaboradores + mês/ano
  - Step 2: ConfirmarDiasUteisModal (confirmar dias úteis, ver feriados via BrasilAPI)
  - Executa `gerarVerbasDoMes()` → cria/atualiza lançamentos em Contas a Pagar
- **Editar** (icon lápis) → Dialog com ColaboradorForm (edit)
- **Deletar** (icon lixo) → Deleta (sem confirmação dialog explícito, direto via mutation)
- **Click linha** → ColaboradorDetalheModal (mostra detalhes completos)

### Componentes Filhos

#### GerarVerbasModal
- **Props:** open, onOpenChange, colaboradores, onConfirm, isPending
- **Step 1:**
  - Month nav (← | Janeiro 2026 | →)
  - Lista checkboxes de colaboradores ativos
  - Mostra estimativa de custo por colab (dinâmica com diasUteis)
  - Total estimado (rounded/estimativa)
  - Warning: "Pendentes existentes substituídos, pagos mantidos"
  - Botão "Próximo: Confirmar Dias Úteis"
- **Callback:** `handleConfirmDiasUteis` abre ConfirmarDiasUteisModal

#### ConfirmarDiasUteisModal
- **Props:** open, onOpenChange, year, month, colaboradores, onConfirm, isPending
- **Features:**
  - Busca feriados via BrasilAPI
  - Mostra lista de feriados encontrados no mês de **pagamento** (próximo mês)
  - Calcula dias úteis automaticamente
  - UI pra ajustar dias úteis (Minus/Plus buttons)
  - Preview de impacto: Mostra VT/VR por colaborador (diário × diasUteis)
  - Warning: "Considera só feriados nacionais; estaduais/municipais (9 Jul/SP) não incluídos"
- **Callback:** `onConfirm(diasUteis)` → executa `gerarVerbasDoMes()` em Colaboradores.tsx
- **Detalhes:** VT/VR são pagos no 1º do mês APÓS competência (função `getPaymentMonth`)

### Achados

#### 🔴 **BUG**
1. **Sem confirmação de DELETE colaborador:**
   - Linha 293: Click trash → direto `del.mutate(c.id)` (sem dialog)
   - Se clicou acidental, colaborador deletado permanentemente
   - **Recomendação:** AlertDialog "Deletar X? Não pode desfazer."

2. **Modo de edição carrega form ineficientemente:**
   - Linhas 47-79: `openEdit()` mapeia 20+ fields de colaborador → form state
   - Usa `(c as any).tipo_dia_salario` — casting frágil
   - Se novo campo adicionado ao schema, quebra
   - **Recomendação:** Type-safe mapping com defaults, schema validation

3. **ConfirmarDiasUteisModal calcula competência errada**
   - Linhas 23-29: `getPaymentMonth(year, month)` com month 0-indexed
   - Mas `month` vem de `now.getMonth()` (0-indexed) em line 24
   - Depois passa `month` direto pra `MESES_PT[month]` (0-indexed okay)
   - **Problema:** Se month=0 (janeiro), competência de janeiro, pagamento fevereiro (month+1)
   - **Check:** Se GerarVerbasModal mostra "Gerar Verbas de Janeiro", ConfirmarDiasUteis mostra "Dias Úteis de Fevereiro" (correto!)
   - **Mas:** UI mostra "VT de Janeiro serão pagos em 01/02/...", com `MESES_PT[month]` = fevereiro. Confunde 0-index/1-index?
   - **Recomendação:** Documentar claramente ou usar enum Month (1-12)

#### 🟡 **UX ruim**
1. **Fluxo "Gerar Verbas" é muitos cliques:**
   - Click "Gerar Verbas do Mês"
   - Selecionar colaboradores (max selecionar todos = default)
   - Confirmar mês
   - Abrir step 2 (ConfirmarDiasUteis)
   - Esperar carregar feriados
   - Ajustar dias úteis (se necessário)
   - Click "Confirmar e Gerar"
   - **Total:** 6-7 cliques pra gerar uma vez por mês
   - **Recomendação:** Integrar ambas modals ou wizard one-page; pré-selecionar "hoje" na GerarVerbasModal

2. **BrasilAPI pode falhar silenciosamente:**
   - Linhas 41-58: `fetchFeriadosNacionais()` se falhar, mostra aviso "Não foi possível carregar"
   - User vê `diasUteis=22` (default) e não sabe se correto
   - **Recomendação:** Retry logic ou sugerir dias manuais como fallback

3. **Preview de impacto pequeno demais:**
   - Linhas 157-186: Preview scrollável (max-h-[150px])
   - Se 30+ colaboradores com VT/VR, user vê só 3-4 linhas
   - **Recomendação:** Expandir altura ou tabela con paginação

4. **Pixa copy sem feedback:**
   - Linha 265: Click copia PIX, mas **sem toast**
   - User não sabe se copiou
   - **Recomendação:** Mudar cursor, tooltip "Copiado!" 2s, ou toast

#### 🟢 **POLISH**
1. **Cards de KPIs sem interatividade:**
   - Linhas 181-209: 3 cards mostrando totais
   - Não são clicáveis; só informativos
   - **Okay, mas:** Se click > filtrar tabela por status=ativo seria útil

2. **Ícone 🎂 emoji hardcoded:**
   - Linha 246: `<Cake className="h-3.5 w-3.5 text-pink-400" /> 🎂`
   - Uma linha usa Lucide Cake icon, outra usa emoji
   - **Recomendação:** Só ícone ou só emoji

3. **Ordering de campos no form:**
   - Linhas 51-77: 20+ fields; sem grupos lógicos visíveis
   - ColaboradorForm deve ter sections (Dados Pessoais, Remun., PIX, etc.)

#### ⚫ **INÚTIL**
1. **`const fmt` redefinido (linha 149):**
   - Já definido em ContasPagar.tsx (linha 59)
   - **Recomendação:** `/lib/format.ts` centralizado

2. **Modal ColaboradorDetalheModal (linhas 322-327):**
   - Abre ao click na linha (linha 242: `onClick={() => setDetalheColab(c)}`)
   - **Faz o quê?** Não incluído na leitura
   - Pode ser redundante com edição
   - **Recomendação:** Se é read-only, documenta; se não é necessário, remover

3. **Obs "Demanda Thales 04/05" em ContasPagar (múltiplas):**
   - Linhas 118-159: 3 comentários grandes explicando auto-folha
   - Demanda entregue, comentários devem ir pra branch PR ou issue
   - **Recomendação:** Remover comentários de demanda resolvida (ou mover pra doc separado)

4. **Helper `isBirthdayThisMonth` (linhas 17-22):**
   - Só usado uma vez (linha 240)
   - Lógica simples; poderia ser inline
   - **Recomendação:** Manter como função se reutilizado; senão, inline

---

## 5. Categorias de Despesa (`/constants/categorias-despesas.ts`)

### Achados

#### 🟡 **UX ruim**
1. **Subcategorias duplicadas:**
   - `folha`: "Outros Folha"
   - `infraestrutura`: "Outros Infraestrutura"
   - `marketing`: "Outros Marketing"
   - Padrão inconsistente; alguns simplesmente "Outros"
   - **Recomendação:** Padronizar como "Outros [categoria]" em todos

2. **Subcategorias hardcoded em constant:**
   - Se user quer adicionar "Água e Esgoto" (diferente de "Água"), precisa code change
   - **Recomendação:** Mover subcategorias pra banco de dados ou config editável (PlanoContas?)

#### ⚫ **INÚTIL**
Nenhum achado (tabela limpa)

---

## RESUMO DE PRIORIDADES

### Críticos (Refactor/Fix)
1. **ContasPagar auto-folha hash:** Remove `updated_at` do colabHash (linha 134)
2. **CartaoDetalhe data fechamento:** Testar casos extremos (31º em meses curtos)
3. **Colaboradores delete:** Adicionar AlertDialog confirmação

### Importantes (UX)
1. **Gerar Verbas:** Consolidar em 1 wizard (não 2 modals sequenciais)
2. **BrasilAPI fallback:** Retry + default sugestão se falha
3. **Marcar Pago:** Integrar confirmação de valor alto na modal (não pre-modal)
4. **Toast feedback:** Adicionar após fechar/reabrir fatura, arquivar cartão, copiar PIX

### Polish (Cosmético)
1. **Centralize `fmt()` → `/lib/format.ts`**
2. **Remover comentários "Demanda Thales" resolvidos**
3. **Threshold R$ 3.000 → config store**
4. **Emoji 🎂 vs Lucide Cake — escolher um**

### Possível Lixo (Validar antes deletar)
1. `cartaoNomeMap` se query já traz nome
2. `mesesComCompras` paging vs lazy-load
3. `todasCompras` em CartaoDetalhe (preload overhead?)
4. `Tab "Lista"` sempre visível vs conditional render
5. `ColaboradorDetalheModal` — read-only ou redundante?

---

## Contexto de Entrega (DATA-001/002)
- Cartões agora com **RLS multi-tenant** + índices FK
- Thales tem ~1-2 cartões cadastrados (pode testar casos extremos com staging)
- Colaboradores: fluxo verbas VT/VR baseado dias úteis (BrasilAPI + manual override)
- ContasPagar: auto-importa folha ao abrir mês (idempotent upsert)

