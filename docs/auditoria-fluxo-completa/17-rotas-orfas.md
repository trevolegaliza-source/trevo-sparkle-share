# 17 — Rotas órfãs (sem entrada no menu)

> Decisão Thales 30/04: menu enxuto. Estas rotas ficam acessíveis só por URL direta.

Lista de rotas que **existem em `App.tsx`** mas **NÃO aparecem no sidebar**:

| Rota | Arquivo | Linhas | Permissão | Status |
|---|---|---|---|---|
| `/processos-ativos` | `ProcessosAtivosDetalhe.tsx` | 111 | `processos` | ⚠️ órfã |
| `/faturamento` | `FaturamentoDetalhe.tsx` | 117 | `financeiro` | ⚠️ órfã |
| `/documentos` | `Documentos.tsx` | 214 | `documentos` | ⚠️ órfã |
| `/catalogo` | `Catalogo.tsx` | 1057 | `catalogo` | ⚠️ órfã (mas linkada do Portfólio) |
| `/inteligencia-geografica` | `InteligenciaGeografica.tsx` | 219 | `intel_geografica` | ⚠️ órfã |
| `/inteligencia-geografica/:uf` | `EstadoDetalhe.tsx` | 740 | `intel_geografica` | ⚠️ órfã |
| `/relatorios/dre` | `RelatoriosDRE.tsx` | 266 | `relatorios_dre` | ⚠️ órfã |
| `/relatorios/fluxo-caixa` | `RelatoriosFluxoCaixa.tsx` | 212 | `fluxo_caixa` | ⚠️ órfã |
| `/reconciliacao-trello` | `ReconciliacaoTrello.tsx` | 428 | **NENHUMA** (PERM-005) | 🔴 órfã + sem proteção |

**Total:** 3364 linhas de código em telas que ninguém vê no menu.

---

## 🔬 Resumos rápidos

### `/processos-ativos` (111 linhas)
Lista filtrada de processos não-finalizados. **Duplica funcionalidade de `/processos` com filtro.**

**Recomendação:** matar (deletar arquivo). Mesmo conteúdo em `/processos` + filtro de status.

### `/faturamento` (117 linhas)
Tabela detalhada de faturamento. **Duplica `/financeiro` → Histórico.**

**Recomendação:** matar OU consolidar como sub-rota tipo `/financeiro/detalhes`.

### `/documentos` (214 linhas)
Lista global de documentos anexados a processos. **Útil de fato** — pra master encontrar contrato/RG sem entrar no cliente.

**Recomendação:** considere adicionar ao menu da Letícia (gerente) — útil pra ela.

### `/catalogo` (1057 linhas — terceiro maior do sistema)
Editor do catálogo de serviços (preços por UF, descrições). Master usa pra atualizar oferta.

**Recomendação:** master usa, mas raramente. Mantém órfã ou move pra Configurações (sub-aba).

### `/inteligencia-geografica` + `/.../:uf` (959 linhas)
Mapa do Brasil com KPIs por estado. Drill-down em UF mostra clientes naquele UF.

**Recomendação:** feature interessante mas se Thales não usa nem mostra, é dead code. Decisão de produto.

### `/relatorios/dre` (266) + `/relatorios/fluxo-caixa` (212)
Relatórios financeiros (Demonstração de Resultado + Fluxo de Caixa). 478 linhas total.

**Recomendação:** master/gerente/financeiro PRECISAM disso eventualmente. **Adicionar ao menu — submenu "Relatórios" com 2 entries.** É feature bizz crítica escondida.

### `/reconciliacao-trello` (428 linhas) 🔴
Reconciliação processos ERP ↔ Trello. **SEM `RequirePermission`** (PERM-005). Qualquer authenticated acessa.

**Recomendação CRÍTICA pré-release:** envolver com `RequirePermission modulo="configuracoes"` (admin-only) OU criar módulo `reconciliacao_trello` no role_templates.

```tsx
// Atual (linha 175 de App.tsx):
<Route path="/reconciliacao-trello" element={<ReconciliacaoTrello />} />

// Sugerido:
<Route path="/reconciliacao-trello" element={
  <RequirePermission modulo="configuracoes">
    <ReconciliacaoTrello />
  </RequirePermission>
} />
```

---

## 🚦 Verdict release amanhã

**🟡 ATENÇÃO** apenas pelo PERM-005 (`/reconciliacao-trello`).

**Fix mínimo (5min):**
- Envolver `ReconciliacaoTrello` com `RequirePermission modulo="configuracoes"` em `App.tsx:175`

Demais rotas órfãs são **decisão de produto** (matar / esconder / promover). Não bloqueiam release amanhã.

## 📝 Sugestões

| ID | Resumo |
|---|---|
| **PERM-005** | (já mapeado) — `/reconciliacao-trello` sem proteção |
| **SUG-NAV-5** | Mover `/relatorios/dre` + `/relatorios/fluxo-caixa` pro menu (submenu Relatórios) |
| **SUG-NAV-6** | Considerar adicionar `/documentos` ao menu da Letícia |
| **SUG-NAV-7** | Avaliar matar `/processos-ativos` e `/faturamento` (dead code que duplica funcionalidade) |
