# 🎨 Auditoria Visual — "está bem feio"

> Thales: *"auditoria no visual do sistema, está bem feio.. não é urgente mas eu tenho toque."*
>
> Avaliação do estado visual atual + sugestões priorizadas.

---

## 📊 Estado atual

### O que tem
- Stack: TailwindCSS + shadcn/ui (Radix primitives)
- Design tokens em `src/index.css` (HSL variables)
- Cores principais: verde Trevo (142 71% 45%), warning amber (38 92% 50%), info azul (210 80% 52%), destructive vermelho
- Modo dark exclusivo (DECISION-001 — aba Aparência removida 13/05)
- Fonte: Inter (Google Fonts)
- Border radius padrão: 0.625rem (10px)
- Sidebar específica com tokens próprios

### O que falta
- **Design system documentado:** não existe Storybook, nem doc visual de componentes
- **Spacing system consistente:** mistura de `gap-2`, `gap-3`, `gap-4` sem regra
- **Tipografia consistente:** tamanhos `text-xs / sm / base / lg / xl / 2xl` usados aleatoriamente
- **Empty states padronizados:** cada tela tem o seu jeito (texto + ícone diferente)
- **Loading states:** uns usam Skeleton, outros Loader2 spinner, outros nada
- **Toast feedback:** uns dão toast.success, outros toast.info, outros nada

---

## 🔴 Problemas visuais GRAVES (alto impacto)

### 1. Hierarquia visual fraca em todas as telas
**Sintoma:** muitos cards do mesmo tamanho, mesma cor, mesma borda. Tudo "parece igual de importante".

**Onde dói:**
- Dashboard: 4 KPIs + 5 alertas + 4 cards + gráfico + 2 listas — tudo em cards branco/cinza neutro. Olho não sabe pra onde ir.
- Financeiro: 3 KPIs + Resumo do Mês + Projeção 30d + Tabs → mesma estrutura visual em todos.
- ClienteDetalhe: 7 tabs com 7 layouts diferentes, mas todas usam Card do shadcn (cinza neutro com border).

**Solução:**
- Mais variação tipográfica (h1: 32px, h2: 24px, h3: 18px, body: 14px) — não 4 níveis de "text-sm" diferentes.
- Cards primários (info crítica) com background sutilmente diferente — não só border.
- "Hero cards" (KPI principal do dia) maiores e mais contrastados que cards secundários.

### 2. Espaçamento inconsistente
**Sintoma:** dois cards lado a lado têm `gap-2` num lugar, `gap-3` em outro, `gap-4` em outro.

**Onde dói:**
- Headers de tela: `flex justify-between items-center` mas alguns têm `gap-4`, outros `gap-2`, outros sem gap.
- Botões em linha: às vezes `gap-1`, às vezes `gap-2`.
- Padding interno de Cards: alguns `p-4`, outros `p-5`, outros `p-6`.

**Solução:**
- Padronizar: `gap-2` (8px) entre elementos pequenos, `gap-4` (16px) entre seções, `gap-6` (24px) entre blocos.
- Card padding: sempre `p-6` em desktop, `p-4` em mobile.
- Comentar a regra no `index.css` ou criar `<Stack gap="sm|md|lg">` component.

### 3. Tipografia sem identidade
**Sintoma:** Inter 400 pra tudo. Sem negrito proporcionado. Sem hierarquia clara entre título de tela vs título de card vs label vs valor.

**Onde dói:**
- Dashboard: "Receita do mês" (label) e "R$ 12.500" (valor) têm tipografia parecida. Devia gritar mais.
- Cards de KPI: número grande deveria ser 32-40px (não 24px). Label do KPI deveria ser uppercase 10px (não 12px regular).

**Solução:**
- Definir escala tipográfica:
  - `.display-1` 48px font-extrabold (números KPI hero)
  - `.display-2` 32px font-bold (valor KPI normal)
  - `.heading-1` 24px font-semibold (título tela)
  - `.heading-2` 18px font-semibold (título card)
  - `.label-uppercase` 10px font-bold uppercase tracking-wider (labels secundárias)
  - `.body` 14px (texto comum)
  - `.caption` 12px (legendas)

### 4. Cores usadas inconsistentemente
**Sintoma:** verde Trevo em ALGUNS lugares (sidebar, primary buttons), mas dashboards / cards principais são cinza/branco. Sistema parece "ERP corporativo qualquer", não "Trevo Legaliza com identidade".

**Onde dói:**
- ClienteDetalhe header: nome do cliente em preto, badge tipo em cinza — onde está o verde?
- Lista /clientes: header verde só no botão "Novo Cliente". Tabela toda neutra.
- /orcamentos: KPIs cinza. Verde só nos badges de "convertido". Apagado.

**Solução:**
- Sidebar: já tem verde — bom.
- Headers de tela: usar accent verde sutilmente (border-bottom, ícone, breadcrumb).
- KPIs primários (Receita, Recebido): cor com **leve fundo verde sutil** (`bg-primary/5`).
- Cards de "ação positiva" (Aprovado, Pago, OK): verde mais forte.
- Cards de "atenção" (vencido, atrasado): vermelho/amber MAIS visível.
- Não-actionable (info, neutro): cinza, mas sem desperdício de espaço.

### 5. PropostaPublica e CobrancaPublica são CUSTOM (CSS inline), o resto é Tailwind
**Sintoma:** as 2 páginas públicas (proposta e cobrança) usam CSS inline com `buildStyles()` e fontes Inter. O resto usa Tailwind. **2 sistemas de design coexistem.**

**Onde dói:**
- Manutenção: mudar cor primária precisa atualizar em 2 lugares.
- Inconsistência: a `/proposta/:token` tem aparência completamente diferente do ERP interno.
- Hardcoded: `#0f172a`, `#f1f5f9`, `#22c55e` espalhados em strings CSS.

**Solução:**
- Migrar PropostaPublica e CobrancaPublica pra Tailwind também.
- OU: manter CSS inline mas centralizar em `src/lib/public-design.ts` exportando tokens.

---

## 🟡 Problemas MÉDIOS

### 6. Modais inconsistentes
- Alguns abrem como `Dialog` (modal centralizado)
- Outros como `AlertDialog` (com Cancel/Confirm)
- Outros são "Bottom Sheets" no mobile (`vaul` library — pouco usada)
- **Sugestão:** decidir: Dialog padrão pra forms, AlertDialog só pra confirmações destrutivas, Drawer pra mobile sempre.

### 7. Empty states sem alma
- "Nenhum cliente encontrado" → texto neutro + ícone genérico
- "Sem processos cadastrados" → idem
- "Nenhuma despesa" → idem
- **Sugestão:** empty state com:
  - Ilustração relevante (não emoji, não Lucide básico) — pode ser pequena ilustração SVG custom
  - Texto motivador ("Bora cadastrar o primeiro!")
  - CTA óbvio (botão Novo X)
  - Talvez "Como funciona?" link pra docs

### 8. Botões com pesos diferentes em situações similares
- Em alguns lugares "Salvar" é primary verde, em outros é outline
- "Cancelar" às vezes é destructive, às vezes é outline, às vezes é ghost
- Botões de ação por linha: às vezes icon-only, às vezes com texto
- **Sugestão:** convenção:
  - **Primary** (verde sólido): ação principal positiva (Salvar, Aprovar, Confirmar, Pagar)
  - **Outline**: ação secundária neutra (Cancelar, Voltar, Editar)
  - **Ghost**: ação terciária (ícones em tabelas, links)
  - **Destructive**: só pra delete/destrutivo
  - Botões em linha de tabela: icon-only + tooltip (Sprint 4 A11Y já cobriu aria-label)

### 9. Badges sem padrão
- Status badges: alguns coloridos, outros outline neutro
- Tipo badges (mensalista, avulso, pré-pago): cores diferentes mas mesmas tonalidades
- "URGENTE", "URGENTE +50%", "DENTRO DO PLANO" — texto variável
- **Sugestão:**
  - Sistema de badges com 5 variants: `success / warning / destructive / info / neutral`
  - Tamanhos: `xs / sm` (não usar `lg` em badge)
  - Sempre uppercase pra status, lowercase pra labels descritivas

### 10. Inputs sem feedback de estado
- Input válido: sem feedback visual (só na borda neutra)
- Input com erro: às vezes vermelho, às vezes nada (toast)
- Input focado: ring verde — bom!
- **Sugestão:**
  - Input com erro: borda vermelha + texto de erro abaixo (não só toast)
  - Validação inline (CNPJ inválido mostra "CNPJ inválido" antes de salvar)
  - Help text opcional (`<span className="text-xs text-muted-foreground">`)

---

## 🟢 Quick wins (1-2h cada)

### Q1. Escala tipográfica documentada (~30min)
Criar classes utilitárias em `index.css`:
```css
.display-1 { @apply text-5xl font-extrabold tracking-tight; }
.heading-1 { @apply text-2xl font-semibold; }
.label-uppercase { @apply text-[10px] font-bold uppercase tracking-wider text-muted-foreground; }
```
Aplicar gradualmente nas telas principais.

### Q2. Empty state component (~1h)
```tsx
<EmptyState
  icon={Users}
  title="Nenhum cliente ainda"
  description="Cadastre seu primeiro cliente pra começar"
  action={<Button>+ Novo Cliente</Button>}
/>
```
Substituir os ~8 empty states espalhados.

### Q3. KPI Card primário com identidade (~1h)
Card de KPI principal do Dashboard ("Faturado") com:
- Background sutil verde (`bg-primary/5`)
- Border accent (`border-primary/30`)
- Ícone à direita
- Número 40px font-extrabold
- Label uppercase 10px
Aplicar em Dashboard / Financeiro / Faturamento.

### Q4. Padronizar cards "atenção" (~1h)
- Vencido / atrasado: fundo `bg-destructive/5`, border `border-destructive/30`
- Aguardando ação tua: fundo `bg-amber-500/5`, border `border-amber-500/30`
- Status OK / pago: fundo `bg-emerald-500/5`, border `border-emerald-500/30`
Aplicar em Alertas do Dashboard / Auditoria / Histórico.

### Q5. Botões consistentes (~1h)
- Sweep manual nos 5-10 lugares onde "Salvar" não é primary
- "Cancelar" sempre `variant="outline"` ou `variant="ghost"` (não destructive)
- Tooltip nos icon-only em tabelas

### Q6. Logo Trevo no ERP interno (~30min)
- Sidebar já tem (vide [`AppSidebar.tsx`](trevo-sparkle-share/src/components/layout/AppSidebar.tsx))
- Outras telas: adicionar logo no header de páginas "públicas adminx" como `/financeiro` ou `/clientes` no breadcrumb

### Q7. Skeleton loading uniforme (~1h)
- Substituir `<Loader2 className="animate-spin">` por `<Skeleton>` em listas/cards/tabelas
- Mais profissional que spinner solitário

### Q8. Dark mode polish (~1h)
- Algumas cores em dark estão muito apagadas (`text-muted-foreground` no dark = quase invisível)
- Aumentar contraste de muted-foreground no dark
- Border do card no dark fica quase invisível também

---

## 🔵 Refactor amplo (sessões dedicadas)

### R1. Design System doc + Storybook (~6h)
- Storybook setup
- Documentar cada component shadcn que usamos
- Showcase de variants
- Tokens documentados visualmente

### R2. PropostaPublica + CobrancaPublica migrar pra Tailwind (~5h)
- Eliminar buildStyles() CSS inline
- Usar Tailwind classes
- Manter responsividade

### R3. Refactor visual completo Dashboard (~3h)
- Hierarquia clara: 1 KPI hero + 4 KPIs secundários + 1 chamada à ação
- Gráfico em vez de números sequenciais
- "Hoje" view (vide doc 06 #6)

### R4. ClienteDetalhe visual rebuild (~6h)
- Hero do cliente: foto/avatar + dados-chave + tags + ações principais
- Tabs com indicador de "tem ação aqui" (badge contador)
- Sub-componentes (vide A.3 deferido)

### R5. /orcamentos lista visual rebuild (~3h)
- Cards com mais espaço, foco em valor + status + última ação
- Filtros laterais visíveis (não só tabs)
- Drag-to-reorder?

---

## 📋 Resumo executivo

**Estado:** visualmente funcional, mas sem identidade própria. Parece "ERP shadcn padrão", não "Trevo Legaliza com personalidade".

**Causa raiz:** ausência de design system documentado + tokens não usados consistentemente + 2 sistemas (Tailwind interno + CSS inline público).

**Caminho mais barato (8-10h)**: aplicar Q1-Q8 quick wins. Sistema fica notavelmente mais polido sem refactor amplo.

**Caminho ideal (~25h):** R1-R5 refactor visual completo. Vira "produto de design", não "ferramenta funcional".

**Sugestão minha:**
- Sessão dedicada de **1 dia (8h)** = Q1+Q2+Q3+Q4+Q5+Q6+Q7+Q8 (todos os quick wins juntos)
- Depois disso, julgar se vale a pena R-tier

---

## ❓ Decisões tuas pendentes

- **Cor primária:** verde Trevo está bom ou tu prefere outro tom (mais escuro, mais vibrante)?
- **Tipografia:** Inter ok ou quer testar Manrope / Plus Jakarta Sans (mais "premium")?
- **Estilo:** mais "minimalista corporativo" (tipo Linear/Stripe) ou mais "colorido amigável" (tipo Notion/Asana)?
- **Mascote:** Dani aparece em cobranças/portfolio. Aparecer mais no ERP interno (header, empty states, etc)?

---

*Criado em 13/05/2026 noite — sessão autônoma 10h. Próxima leitura: o mapa mental do sistema (01-05) que dá contexto técnico.*
