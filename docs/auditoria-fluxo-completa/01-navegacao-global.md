# 01 — Navegação global (sidebar + header + busca)

> Arquivos: `src/components/layout/AppLayout.tsx` (132 linhas), `src/components/layout/AppSidebar.tsx` (138 linhas), `src/components/CommandPalette.tsx`, `src/components/NotificationPopover.tsx`

## 🎯 O que é

A "moldura" do sistema. Tudo logado dentro do `AppLayout` (sidebar à esquerda, header no topo, conteúdo no centro).

Decisão de design declarada no código (linha 13 do AppSidebar):
> Menu enxuto. Dashboard, Relatórios DRE, Fluxo de Caixa, Intel. Geográfica, Portfólio & Preços, Trello ↔ ERP ficam acessíveis só por URL direta — rotas mantidas em App.tsx.

## 🗺️ Mapa de elementos

### Sidebar (esquerda, w-16 colapsada / w-60 expandida)

```
┌────────────────┐
│ 🍀 Trevo Legal │ ← logo + nome
│                │
│ ➕ Cadastro    │ ← navItems filtrados por podeVer()
│ 🔄 Processos   │
│ 👥 Clientes    │
│ 📄 Orçamentos  │
│ 💲 Financeiro  │
│ ⬆️ Contas Pag. │
│ 💳 Cartão      │
│ 👤 Colab.      │
│ ⚙️ Config.     │
│                │
│────────────────│
│ email@trevo... │
│ 🚪 Sair        │
└────────────────┘
```

Comportamento desktop: colapsada w-16 (só ícones), expande pra w-60 no hover.
Comportamento mobile: hamburguer abre overlay full-width.

### Header (topo, h-14)

```
┌──────────────────────────────────────────────────────────┐
│ 🍔 [Buscar processos, clientes...] ⌘K  🌙 🔔 (TB) Thales │
│                                                  Admin   │
└──────────────────────────────────────────────────────────┘
```

Elementos:
- **🍔 Hamburger** — só mobile, abre sidebar
- **Barra de busca** — clicável, abre CommandPalette (atalho global ⌘K)
- **🌙/☀️ ThemeToggle** — alterna dark/light
- **🔔 NotificationPopover** — sino com badge
- **Avatar** — iniciais + nome + role label

### Conteúdo (centro)
`<Outlet />` do react-router. Cada rota renderiza aqui.

## 🔬 Interações detalhadas

### 1. Sidebar — clicar na **logo Trevo Legaliza**
- **O que acontece:** 🔴 **NADA.** Logo é `<img>` simples, sem `<Link>` wrapper. Linha 62-69 de `AppSidebar.tsx`.
- **O que deveria:** navegar pra `/` (Dashboard). Padrão consagrado em webapps.
- **Achado: UX-028 🔴** — bloqueador menor mas é o exemplo que o Thales citou explicitamente.

### 2. Sidebar — clicar em **item do menu**
- **O que acontece:** ✅ navega pra rota correspondente, fecha sidebar mobile.
- **Visual:** item ativo ganha estilo `sidebar-item-active` + ícone com `icon-glow`. OK.
- **Filtro de permissão:** `visibleItems = navItems.filter(item => podeVer(item.modulo))`. ✅ correto.

### 3. Sidebar — hover desktop
- ✅ Expande de w-16 → w-60. Decisão Thales 30/04. Funciona.
- **Bug potencial UX-038 🟢:** se o user move o mouse rápido e sai de cima da sidebar, ela colapsa abrupto. Considere `transition-duration` mais suave nos textos.

### 4. Sidebar — botão "Sair"
- **O que acontece:** chama `signOut()` do `AuthContext`. Limpa cache.
- **O que deveria:** ✅ idem. Confirmar.
- **Achado UX-039 🟡:** clica em "Sair" sem confirmação. Em "sistemas operacionais" perdoa, em ERP financeiro um confirm rápido ajuda contra clique acidental.

### 5. Header — barra de busca
- **O que acontece:** abre `CommandPalette` (modal).
- **Atalho:** ⌘K (ou Ctrl+K). Listener global no window.
- **Comportamento de busca:**
  - Debounce 300ms
  - Busca em `processos.razao_social ILIKE` + `clientes.{nome,apelido,cnpj} ILIKE`
  - Mostra até 5 de cada
  - Setas ↑↓ navegam, Enter abre
- **Achado UX-036 🟡:** ao clicar num processo encontrado, navega pra `/processos` (lista geral) — **não abre o processo específico**. Inútil. Linha 84 do `CommandPalette.tsx`. **Fix:** mudar pra `/clientes/{cliente_id}` (e idealmente scrollar até o processo).
- **Achado UX-037 🟢:** subtitulo do processo (`linha 83`) mostra `p.etapa` raw (ex: "recebidos"). Em vez de label bonito (via `KANBAN_STAGES`).

### 6. Header — ThemeToggle
- **O que acontece:** alterna `dark` ↔ `light` via `next-themes`.
- **Bug não confirmado:** o `defaultTheme="dark"` está hard-coded em `App.tsx:58`. Se o user prefere light em system, sistema ignora `enableSystem`. Acho que esta config conflita: `defaultTheme="dark"` + `enableSystem` — semântica do next-themes é "default só se nenhum system preference detectável". OK.

### 7. Header — Sino (Notificações)
- ✅ Detalhado em `NotificationPopover.tsx`. Auditado de modo independente (ver UX-008 e REL-013 já entregues).
- Estado atual: ✅ scroll funciona, ✅ filter realtime correto, 🟡 roteamento ainda genérico (UX-008 pendente até resolver webhook).

### 8. Header — Avatar
- **O que acontece:** mostra iniciais + nome + role label.
- **O que deveria:** clique abrir um popover com opções (Meu perfil, Trocar empresa, Sair).
- **Achado UX-040 🟡:** Avatar NÃO É CLICÁVEL. Sair vive só no rodapé do sidebar. Confuso pra novos usuários.
- **Achado UX-029 🟡:** `roleLabel` (linha 52 do `AppLayout.tsx`) não mapeia `gerente` — Letícia vai ver só nome, sem etiqueta de role. Mapeamento atual cobre só master/financeiro/operacional/visualizador.

```ts
// Atual
const roleLabel = role === 'master' ? 'Administrador'
  : role === 'financeiro' ? 'Financeiro'
  : role === 'operacional' ? 'Operacional'
  : role === 'visualizador' ? 'Visualizador' : '';
```

Falta `gerente → 'Gerente'`.

### 9. Header — busca via icon mobile
- Ícone separado pra mobile (`sm:hidden`). Abre CommandPalette igual. ✅.

### 10. Mobile — abrir/fechar sidebar
- Hamburger abre, X fecha. Overlay escuro bloqueia conteúdo. ✅.
- `useEffect` linha 37 fecha sidebar a cada `location.pathname` change. ✅ (em mobile) — pra desktop não faz diferença porque sidebar não usa state `open` em desktop.

## 🐛 Bugs/Inconsistências

| ID | Severidade | Problema | Fix |
|---|---|---|---|
| **UX-028** | 🔴 (UX cara) | Logo Trevo não navega pra `/` | Envolver com `<Link to="/">` |
| **UX-029** | 🟡 | `roleLabel` sem mapeamento pra `gerente` | Adicionar linha pro 'gerente' |
| **UX-030** | 🟢 | `master → Administrador` é ambíguo | `master → Master` ou `Dono` |
| **UX-036** | 🟡 | CommandPalette processo navega pra lista (não específico) | path = `/clientes/${cliente_id}` |
| **UX-037** | 🟢 | Subtitulo do processo na busca mostra etapa raw | usar `KANBAN_STAGES.find(s => s.key === etapa)?.label \|\| etapa` |
| **UX-038** | 🟢 | Hover sidebar colapsa abrupto se mouse sai rápido | `transition-duration` maior nos textos |
| **UX-039** | 🟡 | "Sair" sem confirmação | AlertDialog "Sair do sistema?" |
| **UX-040** | 🟡 | Avatar não clicável (sair só vive no sidebar) | Popover com Meu perfil + Sair |
| **REL-016** | 🟢 | Profile name fetch sem cancellation | flag `cancelled` no effect |

## 🎨 Poluição visual

✅ Sidebar enxuto (9 itens). Decisão Thales explícita.
✅ Header limpo, ações alinhadas à direita.
🟡 **Falta breadcrumb.** Em `/clientes/:id` (que tem 7 abas internas), você não vê "onde está" além da URL. Em `/financeiro` (4 abas), idem. Sugestão UX-041: breadcrumb compacto na header esquerda quando rota tem mais de 1 nível.

## 🎯 Sugestões de melhoria

### SUG-NAV-1 — Tornar logo clicável (UX-028)
```diff
- <img src={logoTrevo} alt="Trevo Legaliza" ... />
+ <Link to="/" title="Ir para Dashboard">
+   <img src={logoTrevo} alt="Trevo Legaliza" ... />
+ </Link>
```

### SUG-NAV-2 — Adicionar `gerente` no roleLabel (UX-029)
```diff
const roleLabel = role === 'master' ? 'Administrador'
+   : role === 'gerente' ? 'Gerente'
    : role === 'financeiro' ? 'Financeiro'
    : ...
```

### SUG-NAV-3 — Avatar com popover (UX-040)
Item de média prioridade. Implementação:
- Wrap avatar em `<Popover>`
- Conteúdo: "Meu perfil" (não existe ainda — adiar), "Sair" (mover do sidebar)
- Simplifica sidebar

### SUG-NAV-4 — CommandPalette: abrir processo específico (UX-036)
```diff
items.push({
  id: p.id,
  tipo: 'processo',
  titulo: p.razao_social,
- path: `/processos`,
+ path: `/clientes/${cliente.id}`,
});
```
(idealmente com `?highlight=${p.id}` pra scrollar)

## 🚦 Verdict release amanhã

**🟢 GO.**

Os achados UX-028, UX-029, UX-036 valem 5min cada. UX-029 (Letícia sem label) é o único que ela vai notar no primeiro login. Os outros são UX que ninguém vai reclamar nas primeiras horas.

Recomendo fixar UX-028 + UX-029 antes do release pra "polish" — são 1-line fixes.
