# 07 — Processos (`/processos`)

> Arquivo: `src/pages/Processos.tsx` (710 linhas). **DECISION-001-central.**

## 🎯 O que é

Página kanban operacional de todos os processos da empresa. Mostra 18 colunas (uma por etapa do `KANBAN_STAGES`) e permite drag-and-drop entre elas.

**Permissão:** `modulo='processos'`. Todos os roles veem (master, gerente, financeiro, operacional, visualizador).

⚠️ **Thales pediu pra remover essa tela.** Citação literal: *"PROCESSOS > KANBAN — pode tirar essa merda"*. Veja DECISION-001 no AUDITORIA principal. Análise SQL confirmou: das 18 etapas do kanban, banco só usa 4 na prática (`recebidos` 76%, `registro` 15%, `finalizados` 7%, `concluido` zombies 1%). 14 etapas com ZERO processos.

## 🗺️ Mapa de elementos

```
┌──────────────────────────────────────────────────────────────────┐
│ Processos                                                         │
│ 148 processos no pipeline                                         │
│                                                                   │
│ [Kanban | Lista] [Filtro Tipo▾] [Todos|✓Pagos|⏳Pendentes|⚠Vencidos]│
│ [Etiq A][Etiq B]...  [Export CSV]                                │
├──────────────────────────────────────────────────────────────────┤
│  Recebidos │ Análise  │ Contrato │ Viabili. │ ... 14 mais cols   │
│  ┌────────┐│┌────────┐│┌────────┐│┌────────┐│                    │
│  │card 1  ││ vazio  ││ vazio  ││ vazio  ││ ...                │
│  │card 2  ││         ││         ││         ││                    │
│  └────────┘│└────────┘│└────────┘│└────────┘│                    │
│   ...                                                             │
└──────────────────────────────────────────────────────────────────┘
```

Em modo "Lista" vira tabela simples.

## 🔬 Interações principais

### 1. Toggle Kanban / Lista (linha 334-351)
- Default: kanban
- Lista é tabela paginada (provavelmente útil)

### 2. Filtros
- **Tipo** (linha 353-367) — 6 valores enum: abertura, alteracao, transformacao, baixa, avulso, orcamento
- **Status pagamento** (linha 369-391) — 4 botões: Todos / ✓Pagos / ⏳Pendentes / ⚠Vencidos
- **Etiquetas** (linha 393-415) — chips multi-select

### 3. Export CSV (linha 417+)
Gera CSV dos processos filtrados. Útil pra Excel.

**Achado UX-099 🟢:** export não inclui dados de cliente associados (nome, CNPJ). Adicionar enriqueceria.

### 4. Drag-and-drop entre etapas (linha 309-321)
```ts
const handleDragEnd = useCallback(async (result: DropResult) => {
  if (!result.destination) return;
  const newEtapa = result.destination.droppableId as KanbanStage;
  const procId = result.draggableId;
  updateEtapa.mutate({ id: procId, etapa: newEtapa });

  if (DEFERIMENTO_STAGES.includes(newEtapa)) {
    const proc = (processos || []).find(p => p.id === procId);
    if (proc) {
      await gerarFaturamentoDeferimento(proc as any);
    }
  }
}, [updateEtapa, processos]);
```

**Comportamento:**
- Drag pra qualquer coluna → UPDATE `processos.etapa`
- Se destino é `registro` ou `finalizados` → chama `gerarFaturamentoDeferimento` (que promove lancamento se cliente é `no_deferimento`)

**Achado UX-100 🔴:** **side-effect escondido.** Master arrasta processo pra "Finalizados" pra fechar visualmente — sem saber que isso dispara cobrança automática pra cliente `no_deferimento`. Drag UI deveria ter confirmação ou aviso pré-drop.

**Achado UX-101 🟡:** drag sem confirmação. Dedo escorrega no trackpad/touch, processo vai pra outra coluna. Sem undo evidente. Cliente confuso ("por que esse processo está em 'Conselho' agora?").

**Achado UX-102 🟡:** drag pra `finalizados` **NÃO seta `data_pagamento`** nem `lanc.status='pago'`. Só promove etapa. Inconsistente com botão "Marcar pago" (FEAT-001) que faz a coisa completa. Resultado: processo em "Finalizados" sem lançamento pago — só promovido visualmente.

### 5. Card no kanban
Cada card mostra: razão social, tipo, cliente, etiquetas, data. Clique abre `ProcessoEditModal`.

**Achado UX-103 🟢:** card não mostra valor (R$). Em produção é útil pra priorizar visualmente (processo de R$5k > R$580).

### 6. Botão `[+ Cadastrar Processo]` (header)
Provavelmente leva pra `/cadastro-rapido`. Mesma redundância UX-088 (rota dedicada vs wizard).

## 🐛 Bugs / Inconsistências

| ID | Severidade | Problema | Fix |
|---|---|---|---|
| **UX-099** | 🟢 | Export CSV sem cliente | enriquecer |
| **UX-100** | 🔴 | Drag pra 'registro/finalizados' dispara cobrança sem aviso | confirm modal pre-drop |
| **UX-101** | 🟡 | Drag sem confirm geral | tooltip "Mover pra X?" no hover |
| **UX-102** | 🟡 | Drag pra `finalizados` não marca pago | side-effect coerente OU desabilitar drop direto |
| **UX-103** | 🟢 | Card sem valor R$ | mostrar |
| **DECISION-001** | 🔴 | Tela inteira candidata a remoção | Fase 2 do roadmap |

## 🎨 Poluição visual

🔴 **Kanban com 18 colunas em scroll horizontal.** Difícil ler em 14" laptop. Em mobile vira inutilizável (scroll horizontal + cards minúsculos).

🟡 14 colunas com ZERO uso reduzem signal-to-noise. Quem entra na tela pela primeira vez vê uma estrutura complexa que não reflete a realidade do uso.

## 🚦 Verdict release amanhã

**🟡 ATENÇÃO** — não é bloqueador mas é a tela que mais Letícia (gerente) e secretária podem estranhar.

### Cenários problemáticos pro release:
- Secretária explora `/processos`, arrasta card pra coluna errada por engano. Master tem que reverter manualmente.
- Letícia move processo pra "Finalizados" achando que está organizando — dispara cobrança pra cliente `no_deferimento` (UX-100).

### Fix rápido pré-release (15min):
Adicionar AlertDialog em `handleDragEnd` se destino for `registro` ou `finalizados`:
```tsx
if (DEFERIMENTO_STAGES.includes(newEtapa)) {
  if (!confirm(`Mover pra "${newEtapa}" vai gerar faturamento se este cliente cobrar no deferimento. Confirma?`)) {
    return; // não move
  }
  // ...resto
}
```

### Ou simplesmente:
Esconder `/processos` da sidebar (Thales já reclamou). Aí Letícia/secretária nem encontram. Acessível só por URL direta.

Mas isso é DECISION-001 Fase 2 — refactor maior.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **UX-099** | Export CSV sem dados de cliente |
| **UX-100** | Drag dispara cobrança sem aviso |
| **UX-101** | Drag sem confirm geral |
| **UX-102** | Drag → finalizados não marca pago |
| **UX-103** | Card sem valor R$ |
| **DECISION-001** | (já registrado) — tela inteira candidata a remoção |
