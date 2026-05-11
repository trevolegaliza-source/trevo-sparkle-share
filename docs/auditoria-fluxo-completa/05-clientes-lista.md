# 05 — Clientes (lista, `/clientes`)

> Arquivo: `src/pages/Clientes.tsx` (627 linhas)

## 🎯 O que é

Listagem de todos os clientes da empresa. Stats + filtros + tabela + modal de edição inline.

**Permissão:** `modulo='clientes'`. Master, gerente, financeiro, operacional, visualizador veem.

## 🗺️ Mapa de elementos

```
┌────────────────────────────────────────────────────────┐
│ Clientes                              [+ Novo Cliente] │
│ 47 contabilidades cadastradas                          │
├────────────────────────────────────────────────────────┤
│ ┌────────┬────────┬────────┐                           │
│ │ Total  │ Mensa. │ Avulso │ ← 3 KPI cards            │
│ │   47   │   3    │   44   │                           │
│ └────────┴────────┴────────┘                           │
├────────────────────────────────────────────────────────┤
│ [🔍 Buscar...] [🟦 Inativos (5)] [🟦 Arquivados (2)]   │
│                                                         │
│ Tabela:                                                │
│ ┌───────────────────────────────────────────────────┐ │
│ │ ⚠ │ Nome/Apelido │ CNPJ │ Tipo │ Valor │ ... │     │
│ │ ⚠ │ Cliente A    │ ...  │ Avul │ R$ X  │ ... │     │ ← linha clicável (→ /clientes/:id)
│ │   │ Cliente B    │ ...  │ Mens │ R$ Y  │ ... │     │
│ └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

## 🔬 Interações

### 1. Botão "Novo Cliente" (linha 240-245)
- Link pra `/cadastro-rapido` (wizard guiado, step 1 abre o modal "Novo Cliente")
- ✅ OK. Mas confuso porque `/cadastro-rapido` é "cadastrar processo", não cliente puro.
- **Achado UX-088 🟢:** rota deveria ser `/clientes/novo` ou abrir modal direto, sem passar pelo wizard de processo.

### 2. Filtros
- **Busca** — `useClientes(search)` filtra por nome/apelido/codigo/contador (server-side, ✅)
- **Inativos** — clientes sem processos OU sem processo novo nos últimos 10 dias (regra arbitrária, linha 73-77)
- **Arquivados** — `is_archived=true`
- Toggles mutuamente exclusivos (linha 280, 289) ✅

**Achado UX-077 🟢:** "Inativo" baseado em 10 dias sem processo é critério arbitrário. Cliente mensalista que paga em dia mas só pede 1 processo por mês cai em "inativo" injustamente. Considere: "sem fatura paga nos últimos 60d" ou tornar configurável.

### 3. Filtro por estado (query param `?estado=SP`)
- Vem do `/inteligencia-geografica/:uf` (drill-down)
- Badge clicável "Estado: SP ✕" remove filtro

### 4. Tabela — linha do cliente
- **Clique simples** (linha 334) → navega `/clientes/:id`
- **Duplo clique** (linha 335) → abre modal de edição inline

**Achado UX-082 🟡:** doppelclick pra editar é **anti-padrão em mobile/tablet** (não existe). User no celular não consegue editar. Sugestão: botão "Editar" inline na coluna Ações OU menu de contexto (...) consistente com outras telas.

### 5. Coluna "Compliance" (8px de largura)
- Mostra `ShieldAlert` vermelho se sem contrato (linha 339-352)
- Tooltip "Atenção: Contrato não anexado"

**Achado UX-086 🟢:** coluna sem header — o user não sabe o que aquele "⚠" significa até hover. Em mobile, tooltip nem aparece. Sugestão: header "✓" + texto "contrato" abaixo do ícone OU mover pra última coluna como badge.

### 6. Tipo
- Badge "Mensalista" (verde) ou "Avulso" (amarelo) (linha 372-374)

**Achado UX-083 🟡:** **só 2 valores exibidos.** Banco tem 4 tipos:
- `AVULSO_4D`
- `MENSALISTA`
- `PRE_PAGO`
- `PRECO_POR_TIPO`

Linha 372-374 mostra `Mensalista` pra MENSALISTA e `Avulso` pra **todo o resto**. PRE_PAGO e PRECO_POR_TIPO viram "Avulso" — semanticamente errado.

**Fix:**
```ts
const tipoLabel = {
  MENSALISTA: 'Mensalista',
  AVULSO_4D: 'Avulso (D+4)',
  PRE_PAGO: 'Pré-pago',
  PRECO_POR_TIPO: 'Preço fixo',
}[client.tipo] || client.tipo;
```

**Mesmo problema nos Stats cards (linha 219-221):**
```ts
const mensalistas = ...filter(c => c.tipo === 'MENSALISTA').length;
const avulsos = ...filter(c => c.tipo === 'AVULSO_4D').length;  // ← exclui PRE_PAGO, PRECO_POR_TIPO
```
PRE_PAGO e PRECO_POR_TIPO somem da contagem. Total não bate.

### 7. Coluna Processos
- Badge colorido baseado em `getProcessBadgeClass`:
  - **Cinza** se 0 processos
  - **Verde** se todos done (`activeCount=0 && doneCount=total`)
  - **Amarelo** se algum em andamento

**Achado UX-076 🟡 (DECISION-001-relacionado):** definição "done" usa `etapa==='finalizados' || 'arquivo'`. Quando DECISION-001 simplificar pra binário, esta lógica simplifica também.

### 8. Modal de Edição (após doppelclick)
- Modal grande com ~30 campos: identificação, financeiro, endereço, contatos, contratos
- Upload de contrato com PDF/PNG/JPG, max 10MB ✅
- Preview de contrato em modal próprio
- Download / Delete contrato (delete com `PasswordConfirmDialog` ✅)

**Achado UX-089 🟡:** modal de edit pode ser tela inteira (1000+ linhas de form em `<Dialog>`). Mobile vira inferno. Sugestão: rota `/clientes/:id/editar` em vez de modal.

**Achado UX-090 🟢:** delete contrato exige password (boa prática), mas edit de campos não. Decisão de produto.

## 🐛 Bugs / Inconsistências

| ID | Severidade | Problema | Fix |
|---|---|---|---|
| **UX-077** | 🟢 | "Inativo" 10 dias arbitrário | configurável ou critério melhor |
| **UX-082** | 🟡 | Edit por doppelclick — quebrado em mobile | botão edit na coluna Ações |
| **UX-083** | 🟡 | Tipo só mostra 2 valores (3 e 4 viram "Avulso") | mapping completo |
| **UX-085** | 🟡 | Stats cards excluem PRE_PAGO/PRECO_POR_TIPO | adicionar contagem |
| **UX-086** | 🟢 | Coluna ⚠ sem header | label visível |
| **UX-088** | 🟢 | "Novo Cliente" cai em /cadastro-rapido (wizard de processo) | rota dedicada `/clientes/novo` |
| **UX-089** | 🟡 | Modal de edit gigante quebra mobile | rota própria |
| **UX-090** | 🟢 | Edit sem password, delete contrato com password | decisão de produto |
| **UX-076** | 🟡 | activeCount/doneCount usa etapa kanban | DECISION-001-relacionado |

## 🎨 Poluição visual

🟢 Layout limpo. Tabela legível.
🟡 Mobile sofre: 8 colunas + tabela densa. Considere card view em mobile (`hidden lg:table` + `lg:hidden` card list).

## 🚦 Verdict release amanhã

**🟢 GO.**

Os 9 achados são polish ou casos edge. Letícia/secretária vão usar a tabela tranquilas em desktop.

**Recomendação:**
- Se tiver 30min, fix UX-083 + UX-085 (tipo + stats certos pros 4 tipos). 5 linhas. Confiança de dado pra master.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **UX-076** | activeCount usa etapa kanban (DECISION-001-rel) |
| **UX-082** | Edit por doppelclick quebra mobile |
| **UX-083** | Tipo cliente só exibe 2 valores |
| **UX-085** | Stats excluem PRE_PAGO/PRECO_POR_TIPO |
| **UX-086** | Coluna compliance sem header |
| **UX-088** | "Novo Cliente" vai pro wizard de processo |
| **UX-089** | Modal de edit gigante quebra mobile |
| **UX-090** | Edit sem password vs delete contrato com password (inconsistente) |
