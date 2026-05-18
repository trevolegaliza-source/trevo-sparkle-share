# 🎨 Design System — Trevo ERP

> Referência viva. Atualizar quando criar componente novo ou mudar token.
> Última atualização: **18/05/2026** (Onda 10 pré-viagem).

## 🎯 Identidade visual

| Elemento | Valor | Decidido em |
|---|---|---|
| **Cor primária** | Verde Trevo `#16a34a` (HSL CSS var `--primary`) | 14/05/2026 ✅ |
| **Tipografia** | Plus Jakarta Sans | 14/05/2026 ✅ |
| **Modo padrão** | Dark | 14/05/2026 ✅ |
| **Estilo** | Linear-like minimalista (borda sutil, accent bar lateral 3px) | 14/05/2026 ✅ |

## 🌈 Paleta (tokens HSL CSS)

Variáveis em `globals.css` — uso via Tailwind: `bg-primary`, `text-destructive`, etc.

| Token | Uso | Componente exemplo |
|---|---|---|
| `--primary` | Verde Trevo, CTA, accents principais | `KPICard variant=hero` |
| `--destructive` | Erros, alertas críticos, vermelho | `AttentionCard tone=danger` |
| `--muted` | Backgrounds neutros, placeholders | `Card` |
| `--accent` | Hover states, secundário | `Button variant=ghost` |
| `--border` | Bordas sutis | `Card`, `Input` |
| `--background` | Fundo de página | `body` |
| `--foreground` | Texto principal | `<p>` |

### Cores extras (Tailwind direto, não tokens)

| Cor | Quando usar |
|---|---|
| `emerald-500/600` | Sucesso, pago, OK (verde tom mais quente que primary) |
| `amber-500/600` | Atenção, aguardando, vencendo |
| `blue-500/600` | Feature Aguardando (estado intermediário, neutro) |
| `violet-500` | Pré-pago (visual exclusivo desse tipo de cliente) |
| `sky-500` | Preço por tipo |

## 📦 Componentes UI customizados (não shadcn)

Localização: `src/components/ui/`. Esses 5 são da **casa Trevo** — sempre prefirir em vez de inline ad-hoc.

### 1. `KPICard` ([kpi-card.tsx](src/components/ui/kpi-card.tsx))

KPI grande em grid. Substitui card inline com number + label.

**Props:** `label`, `value`, `icon?`, `variant`, `hint?`, `trend?`, `onClick?`

**Variants:**
- `hero` — card principal verde (CTA do user), valor grande
- `default` — secundário neutro
- `success` — pago/recebido/OK
- `warning` — aguardando/vencendo
- `danger` — vencido/inadimplente

**Padrão de uso:** sempre que precisar mostrar 1 número com contexto. Receita do mês, DSO, contagem de processos, etc.

### 2. `AttentionCard` ([attention-card.tsx](src/components/ui/attention-card.tsx))

Card de alerta/destaque com ícone + título + descrição + ação opcional.

**Props:** `tone`, `icon?`, `title`, `description?`, `action?`, `onClick?`

**Tones:** `danger`, `warning`, `success`, `info`

**Padrão de uso:** Dashboard "Ações Urgentes", "Vai bater o mês?", banner de aviso pra Letícia.

### 3. `EmptyState` ([empty-state.tsx](src/components/ui/empty-state.tsx))

Substitui texto cru "Nenhum X encontrado". Tem ícone + título + descrição + ação opcional.

**Props:** `icon?`, `title`, `description?`, `action?`, `variant`

**Variants:** `default` (card sutil), `inline` (sem fundo — pra dentro de Card)

**Padrão de uso:** lista vazia, busca sem resultado, primeiro acesso a uma tela.

### 4. `PageHeader` ([page-header.tsx](src/components/ui/page-header.tsx))

Header padronizado de página. Title + subtitle + accent.

**Padrão de uso:** topo de cada rota (`<PageHeader title="Clientes" />`).

### 5. `SkeletonPatterns` ([skeleton-patterns.tsx](src/components/ui/skeleton-patterns.tsx))

5 helpers de skeleton estruturado.

| Helper | Quando usar |
|---|---|
| `SkeletonCard` | Card individual (KPI placeholder) |
| `SkeletonList rows={N}` | Lista de N itens |
| `SkeletonTable rows={R} cols={C}` | Tabela com header |
| `SkeletonKPIs count={N}` | Grid de N KPI cards |
| `SkeletonPage` | Página inteira (header + KPIs + lista) |

**Padrão de uso:** loading state. NUNCA usar `Loader2 + "Carregando..."` em loading de página/lista — só em mutations dentro de botões.

### 6. `ValorProtegido` ([auth/ValorProtegido.tsx](src/components/auth/ValorProtegido.tsx))

Renderiza valor monetário OU `•••••` se user não pode ver dinheiro.

**Padrão de uso:** SEMPRE que `formatBRL(valor)` aparece em tela acessível por perfil sem `podeVerValores`. Operacional/visualizador veem máscara.

## 🧱 Padrões de layout

### Page wrapper

```tsx
<div className="space-y-6">
  <PageHeader title="X" subtitle="Y" />
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {/* KPIs */}
  </div>
  {/* Conteúdo principal */}
</div>
```

### Loading state padrão

```tsx
if (isLoading) {
  return (
    <div className="space-y-6">
      <PageHeader title="X" subtitle="Y" />
      <SkeletonKPIs count={4} />
      <SkeletonList rows={4} />
    </div>
  );
}
```

### Empty state padrão

```tsx
{items.length === 0 ? (
  <EmptyState
    icon={Users}
    title="Nenhum X ainda"
    description="Cadastre o primeiro X pra começar"
    action={<Button onClick={...}>+ Novo</Button>}
  />
) : (
  items.map(...)
)}
```

## 🚫 O que evitar

- ❌ `<Loader2 className="animate-spin" />` em loading de página/lista — usar Skeleton
- ❌ `<Card>...inline número grande hardcoded...</Card>` pra KPI — usar `KPICard`
- ❌ `<p>Nenhum X encontrado</p>` — usar `EmptyState`
- ❌ `bg-emerald-500` ou `bg-red-500` hardcoded pra erro/sucesso — usar variants dos componentes
- ❌ `formatBRL(valor)` sem `ValorProtegido` em tela acessível por operacional/visualizador

## 📚 Onde olhar exemplos

| Tela | Padrão exemplar |
|---|---|
| [Dashboard.tsx](src/pages/Dashboard.tsx) | KPIs + AttentionCard + sub-seção DSO |
| [Financeiro.tsx](src/pages/Financeiro.tsx) | 5 KPIs + Skeleton + Resumo do Mês |
| [ClienteAccordionFinanceiro.tsx](src/components/financeiro/ClienteAccordionFinanceiro.tsx) | Feature Aguardando (popover + badges) |
| [Hoje.tsx](src/pages/Hoje.tsx) | Skeleton estruturado + items contextuais |

## 🔮 Roadmap futuro do Design System (não atacado)

- **Storybook completo** (6h) — visualizar componentes isoladamente, props variants
- **Tokens versionados** — sair de HSL var bruta pra design tokens estruturados
- **Modo light decente** — hoje funciona mas dark é primário
- **Componentes mobile-first** — alguns ainda têm fricção em touch
