# 03 — Dashboard (`/`)

> Arquivo: `src/pages/Dashboard.tsx` (630 linhas)

## 🎯 O que é

Home logo após login (rota `/`). Visão executiva de KPIs financeiros, alertas urgentes, pipeline operacional e top clientes.

**Permissão:** `modulo='dashboard'` — `master`, `gerente`, `operacional`... espera. `operacional` NÃO tem `dashboard` no template (PERM-002). Se user `operacional` (secretária) cai em `/`, ele vê fallback "Bem-vindo ao sistema. Aguarde seu administrador configurar seu acesso." (linha 289). Mensagem desnecessariamente angustiada — eles já têm acesso a outras coisas.

## 🗺️ Mapa de elementos

```
┌─────────────────────────────────────────────────────────┐
│ Boa tarde, Thales 🍀     [Relatório Mensal] (financeiro)│
│ segunda-feira, 11 de maio de 2026                       │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────┬──────────┬──────────┐           │
│ │ Receita  │ A Receber│ Recebido │ Processos│ ← 4 KPI cards
│ │ R$ 23k   │ R$ 5k    │ R$ 18k   │ 42 ativ. │           │
│ │ +12%     │ pend.    │ 78%      │ +5 novos │           │
│ └──────────┴──────────┴──────────┴──────────┘           │
├─────────────────────────────────────────────────────────┤
│ AÇÕES URGENTES                                          │
│ [🔴 3 cobranças vencidas]    [→ /financeiro?tab=vencidos]│
│ [🟡 5 clientes sem extrato]  [→ /financeiro?tab=cobrar]  │
│ ...                                                      │
├─────────────────────────────────────────────────────────┤
│ PIPELINE DE PROCESSOS                                   │
│ ┌────┬────┬────┬────┬────┐                              │
│ │Ent.│Andt│Pend│Fin │Conc│ ← 5 fases (mapeia kanban)    │
│ │ 12 │ 8  │ 3  │ 5  │ 14 │                              │
│ └────┴────┴────┴────┴────┘                              │
├─────────────────────────────────────────────────────────┤
│ RECEITA MENSAL (últimos 6 meses)                        │
│ [gráfico de barras]                                     │
├─────────────────────────────────────────────────────────┤
│ TOP CLIENTES DO MÊS           PRÓXIMOS VENCIMENTOS      │
│ 1. Cliente X     R$ 5k        Cliente A   12/05 R$ 870  │
│ 2. Cliente Y     R$ 3k        Cliente B   15/05 R$ 580  │
│ ...                            ...                       │
└─────────────────────────────────────────────────────────┘
```

## 🔬 Interações

### 1. Header — saudação dinâmica
- ✅ "Bom dia / Boa tarde / Boa noite, [Nome] 🍀" baseado em hora atual
- Mostra data por extenso. ✅ Toque humano.

### 2. Header — botão "Relatório Mensal"
- Visível só se `podeVer('financeiro')` (linha 324)
- Gera PDF via `gerarRelatorioMensal()` (helper)
- Achado UX-064 🟢: botão fica "loading" como `Gerando...` — bom feedback. ✅

### 3. KPI Cards (4 cards no grid)

| Card | Onclick | Achado |
|---|---|---|
| **Receita do mês** | navega `/financeiro` | ✅ |
| **A Receber** | navega `/financeiro` | ✅ |
| **Recebido** | 🔴 SEM onClick! | UX-054 |
| **Processos ativos** | navega `/processos` | ✅ (DECISION-001-relacionado) |

**Achado UX-054 🟡:** "Recebido" não navega (linha 381 — `<GlassCard>` sem `onClick`). Quebra padrão dos 3 vizinhos. Fix de 1 prop.

**Achado UX-055 🟢:** Card "A Receber" mostra só o valor — sem indicador de quantidade (qtos lançamentos? qtos clientes?). Cruzar com REL-020 abaixo.

**Achado UX-056 🟢:** Variação "% vs mês anterior" (linha 357-360) — quando mês anterior é R$0, retorna +100% (ou +Infinity?). Edge case em começo de operação. Considerar "—" quando ant=0.

### 4. Seção "Ações urgentes" (alertas)
Alertas calculados em `calc.alertas[]`:
- `vencidas` 🔴 — N cobranças vencidas → `/financeiro?tab=vencidos`
- `sem_extrato` 🟡 — clientes sem extrato → `/financeiro?tab=cobrar`
- `nao_enviadas` 🟡 — extratos não enviados → `/financeiro?tab=enviados`
- `auditoria_pendente` 🟡 — processos esperando auditoria → `/financeiro` + state.tab='auditoria'
- `parados` 🟡 — sem movimentação 7+ dias → `/processos` (DECISION-001-relacionado)
- `contas_pagar_vencidas` 🔴 — N contas → `/contas-pagar`
- `contas_pagar_proximas` 🟡 — N contas → `/contas-pagar`
- `mensalista_X` 🔴 — cada mensalista sem fatura → `/clientes/{id}`

**Achado UX-059 🟡 (= UX-018):** alerta "auditoria_pendente" usa `state.tab='auditoria'` (linha 175), outros usam querystring (`?tab=vencidos`). Convenção inconsistente. Provavelmente um dos 2 não funciona. Fix unificar.

**Achado UX-062 🟢:** mensalista sem fatura no mês cai como `severity='critical'` (linha 209). Isso é caso normal (fatura ainda não foi gerada). `warning` seria mais apropriado.

**Achado REL-020 🟡:** `contas_pagar` filter (linha 186-189) pega `venc < hoje` sem checar `status='pago'`. Contas pagas e vencidas há tempo podem aparecer no alerta. Bom verificar `useContasPagar.ts` se já filtra antes.

**Achado UX-065 🟢:** alertas não têm "ação inline" (ex: "Marcar como pago" direto no alerta). Tem que clicar pra ir ao módulo. Pra alertas de mensalista, "Gerar fatura agora" inline economiza 3 cliques.

### 5. Pipeline de processos (DECISION-001-relacionado)
- Linha 215-221: hard-coded mapeamento de 18 etapas em 5 fases
- Clica numa fase → navega `/processos` (e o filtro ativa? Não confirmei)
- **Esta seção INTEIRA é candidata a remoção** quando DECISION-001 for atacada (kanban operacional não rastreado pelo sistema)

### 6. Gráfico Receita Mensal
- Recharts com 6 colunas (últimos 6 meses)
- 3 cores: Recebido (verde) / Pendente (amarelo) / Vencido (vermelho)
- Achado UX-066 🟢: gráfico não tem tooltip personalizado em mobile (pode ser quebra de UX em telas pequenas)

### 7. Top Clientes
- 5 clientes com maior `total_faturado` no mês
- Cada um clicável → `/clientes/${id}` ✅
- Badge de status: vencido / pendente / sem_extrato

**Achado UX-060 🟢:** clica em "Top Cliente" cai em `/clientes/:id` na aba default ("Financeiro-config"). Talvez seria melhor cair na aba "Faturas" diretamente (afinal estamos vendo top FATURAMENTO). Considerar `?aba=faturas`.

### 8. Próximos vencimentos
- Lista de 5 lançamentos com vencimento próximo
- Achado UX-061 🟢: linha por linha mostra cliente + data + valor. **Não navega ao clicar.** Adicionar onClick → `/clientes/${cliente_id}`.

## 🐛 Bugs / Inconsistências

| ID | Severidade | Problema | Fix |
|---|---|---|---|
| **UX-054** | 🟡 | KPI "Recebido" sem onClick | adicionar `onClick={() => navigate('/financeiro?tab=historico')}` |
| **UX-055** | 🟢 | "A Receber" sem qtd de lançamentos | mostrar "X lançamentos" abaixo |
| **UX-056** | 🟢 | Variação +100% quando ant=0 | mostrar "—" |
| **UX-059** | 🟡 | Routing mixed (state vs querystring) | uniformizar query |
| **UX-060** | 🟢 | Top Cliente cai em aba default | `/clientes/${id}?aba=faturas` |
| **UX-061** | 🟢 | Próximos vencimentos sem onClick | adicionar |
| **UX-062** | 🟢 | Mensalista sem fatura como `critical` | trocar pra `warning` |
| **UX-063** | 🟡 | Fallback "Aguarde administrador" desanima `operacional` | mostrar atalhos ou tela de boas-vindas com links pros módulos que ele TEM |
| **UX-065** | 🟢 | Alertas sem ação inline | "Gerar fatura agora" pra mensalistas |
| **UX-066** | 🟢 | Gráfico mobile sem tooltip | testar e fix se quebra |
| **REL-015** | 🟡 (já mapeado) | "Clientes sem extrato" filtra só solicitacao_criada | incluir aguardando_deferimento |
| **REL-020** | 🟡 | Contas pagar vencidas inclui pagas? | check `status` antes |
| **DECISION-001-rel** | 🔴 | Pipeline + alertas "parados" duplicam kanban | remover quando DECISION-001 for executada |

## 🎨 Poluição visual

✅ Layout limpo, GlassCards bonitos com glow contextual (cor por severidade).
✅ Animações sutis (`logo-pulse`, `animate-trevo-wave`).
🟡 Densidade alta em telas pequenas: 4 KPI cards + alertas + pipeline + gráfico + 2 tabelas. Mobile vira scroll infinito.
🟡 Pipeline de 5 fases ocupa espaço considerável e é tudo o que vai sumir com DECISION-001.

## 🚦 Verdict release amanhã

**🟢 GO** para Thales (master) e Letícia (gerente).
**🟡 ATENÇÃO** pra secretária (operacional).

### Pra secretária (UX-063):
Quando ela logar, vai cair em `/`, sem permissão `dashboard`, vê: "Bem-vindo ao sistema. Aguarde seu administrador configurar seu acesso." É **falso** — ela já tem acesso. Pode achar que falta algo e te ligar.

**Fix 30min antes do release:** trocar mensagem por tela útil:
```tsx
if (!permsLoading && !podeVer('dashboard') && !isMaster()) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <h2 className="text-xl font-semibold">Bem-vindo, {nome} 🍀</h2>
      <p className="text-muted-foreground">Atalhos do seu dia-a-dia:</p>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        {podeVer('processos') && <Link to="/processos">→ Processos</Link>}
        {podeVer('clientes') && <Link to="/clientes">→ Clientes</Link>}
        {podeCriar('processos') && <Link to="/cadastro-rapido">→ Cadastro Rápido</Link>}
        {podeVer('documentos') && <Link to="/documentos">→ Documentos</Link>}
      </div>
    </div>
  );
}
```

### Alternativa mais simples:
Adicionar `dashboard` no template `operacional` (PERM-002). Aí ela cai num dashboard simples (sem KPIs financeiros, porque `podeVer('financeiro')` é false em vários cards).

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **UX-054** | KPI "Recebido" sem onClick |
| **UX-055** | "A Receber" sem qtd |
| **UX-056** | Variação +100% quando ant=0 |
| **UX-059** | (= UX-018) routing mixed |
| **UX-060** | Top Cliente cai em aba default |
| **UX-061** | Próximos vencimentos sem onClick |
| **UX-062** | Mensalista sem fatura como critical |
| **UX-063** | Fallback "aguarde admin" desanima operacional |
| **UX-065** | Alertas sem ação inline |
| **UX-066** | Gráfico mobile sem tooltip |
| **REL-020** | Contas pagar vencidas pode incluir pagas |
