# 🎨 Ordem recomendada — Redesign visual sistema

> **Criado:** 14/05/2026
> **Como usar:** abre o arquivo HTML da tela que vai trabalhar no Claude Design, itera o visual, devolve o arquivo pra mim e eu implemento no React mantendo a lógica. Mesma rotina que fizemos com OrcamentoNovo.

---

## 📋 Estado atual

| Tela | Arquivo | Status |
|---|---|---|
| ✅ OrcamentoNovo | `orcamentos/orcamento-novo.html` | **JÁ IMPLEMENTADO** (commit 9a0b778) |
| ✅ PropostaPublica | `publicas/proposta-publica.html` | Extraído (não implementado) |
| ⏳ Dashboard | `dashboard/dashboard.html` | Aguardando design |
| ⏳ Hoje | `hoje/hoje.html` | Aguardando design |
| ⏳ MRR Dashboard | `mrr/mrr.html` | Aguardando design |
| ⏳ Financeiro | `financeiro/financeiro.html` | Aguardando design |
| ⏳ Clientes lista | `clientes/clientes-lista.html` | Aguardando design |
| ⏳ Cliente · Financeiro | `clientes/cliente-aberto/financeiro.html` | Aguardando design |
| ⏳ Cliente · Serviços | `clientes/cliente-aberto/servicos.html` | Aguardando design |
| ⏳ Cliente · Processos | `clientes/cliente-aberto/processos.html` | Aguardando design |
| ⏳ Cliente · Faturas | `clientes/cliente-aberto/faturas.html` | Aguardando design |
| ⏳ Cliente · Contratos | `clientes/cliente-aberto/contratos.html` | Aguardando design |
| ⏳ Cadastro Rápido | `cadastro-rapido/cadastro-rapido.html` | Aguardando design |
| ⏳ Orçamentos lista | `orcamentos/orcamentos-lista.html` | Aguardando design |
| ⏳ Contas a Pagar | `contas-pagar/contas-pagar.html` | Aguardando design |
| ⏳ Cartão lista | `cartao/cartao-lista.html` | Aguardando design |
| ⏳ Cartão aberto | `cartao/cartao-aberto.html` | Aguardando design |
| ⏳ Colaboradores | `colaboradores/colaboradores.html` | Aguardando design |
| ⏳ Configurações | `configuracoes/configuracoes.html` | Aguardando design |
| ⏳ Cobrança Pública | `publicas/cobranca-publica.html` | Aguardando design |
| ⏳ Login | `auth/login.html` | Aguardando design |

---

## 🎯 Ordem RECOMENDADA (por impacto)

### 🔥 Fase 1 — Telas mais usadas (ataca primeiro)

Telas em que tu passa MAIS TEMPO no dia. Investe o capricho aqui que o ROI é alto.

| # | Tela | Por quê | Tempo estimado redesign + implementação |
|---|---|---|---|
| 1 | **Dashboard** `/` | Primeira tela após login, vê todo dia ao abrir o sistema | ~30min design + 1h impl |
| 2 | **Hoje** `/hoje` | Tela "o que importa agora" — ferramenta mais valiosa pra rotina diária | ~30min + 1h |
| 3 | **Financeiro** `/financeiro` | Coração financeiro — abre múltiplas vezes/dia | ~45min + 1.5h |
| 4 | **Cliente · Financeiro** (aba padrão) | Onde tu mexe quando abre cliente — primeira impressão | ~45min + 1.5h |
| 5 | **Cliente · Faturas** | Onde gera extratos / Asaas — fluxo crítico | ~45min + 2h (ClienteAccordionFinanceiro 2300 LOC) |

**Total Fase 1: ~3h design + ~7h implementação. Sistema fica notavelmente melhor.**

---

### 🟡 Fase 2 — Telas de gestão (atacar depois)

Usadas várias vezes/semana. Já têm valor alto mas não diário.

| # | Tela | Tempo |
|---|---|---|
| 6 | **Clientes lista** `/clientes` | ~30min + 1h |
| 7 | **Cadastro Rápido** `/cadastro-rapido` | ~30min + 1h |
| 8 | **Orçamentos lista** `/orcamentos` | ~30min + 1h |
| 9 | **Cliente · Processos** | ~20min + 45min |
| 10 | **Cliente · Serviços** | ~20min + 45min |
| 11 | **Cliente · Contratos** | ~20min + 45min |
| 12 | **MRR Dashboard** `/mrr` | ~30min + 1h |

**Total Fase 2: ~3h design + ~6h implementação.**

---

### 🟢 Fase 3 — Telas secundárias (último a atacar)

Menos usadas. Pode esperar pra ter polish total.

| # | Tela | Tempo |
|---|---|---|
| 13 | **Contas a Pagar** `/contas-pagar` | ~45min + 1.5h |
| 14 | **Cartão lista** `/cartao` | ~30min + 1h |
| 15 | **Cartão aberto** `/cartao/:id` | ~30min + 1h |
| 16 | **Colaboradores** `/colaboradores` | ~30min + 1h |
| 17 | **Configurações** `/configuracoes` | ~30min + 1h |

**Total Fase 3: ~2.5h design + ~5.5h implementação.**

---

### 🔵 Fase 4 — Telas públicas (cliente final vê)

Cliente vê isso quando recebe link do Thales. **Visual aqui afeta reputação.**

| # | Tela | Tempo |
|---|---|---|
| 18 | **Cobrança Pública** `/cobranca/:token` | ~45min + 1.5h |
| 19 | **Proposta Pública** `/proposta/:token` | ~30min + 1h |
| 20 | **Login** `/login` | ~20min + 30min |

**Total Fase 4: ~1.5h design + ~3h implementação.**

---

## ⏱️ Tempo total estimado

| Fase | Telas | Design (você no Claude Design) | Implementação (eu no React) |
|---|---|---|---|
| 1 | 5 | ~3h | ~7h |
| 2 | 7 | ~3h | ~6h |
| 3 | 5 | ~2.5h | ~5.5h |
| 4 | 3 | ~1.5h | ~3h |
| **TOTAL** | **20 telas** | **~10h** | **~21h** |

**Total real**: ~31h spread em quantas sessões quiser. Tipicamente ~3-5 telas por sessão.

---

## 🎨 Diretrizes pra manter consistência

Quando tu desenha cada tela no Claude Design, **mantém estes padrões** pro sistema ficar coeso:

### Cores
- **Verde Trevo**: `#16a34a` (principal) / `#22c55e` (dark mode)
- **Slate-900**: `#0f172a` (textos principais)
- **Slate-500**: `#94a3b8` (textos secundários, captions)
- **Cores semânticas**:
  - Sucesso/emerald: `#10b981`
  - Atenção/amber: `#f59e0b`
  - Erro/red: `#ef4444`
  - Info/blue: `#3b82f6`

### Tipografia
- **Família**: Plus Jakarta Sans (já carregada)
- **Letter-spacing**: -0.025em em headings, -0.005em em corpo
- **Hierarquia**:
  - `heading-1` 24px/800
  - `heading-2` 16px/600
  - `display-2` 32px/700 (KPIs)
  - `caption` 12px/400 slate-500
  - `label-uppercase` 10px/600 uppercase tracking-wider

### Componentes recorrentes
- **Page header**: barra verde `width: 3px` à esquerda do título
- **Cards**: `border: 1px solid #e2e8f0`, `border-radius: 12px`, `padding: 20px`
- **Botões primary**: `bg-emerald-600`, `text-white`, `font-semibold`
- **Botões outline**: `border: 1px solid #e2e8f0`, hover: borda verde
- **KPI cards**: variantes hero (gradient verde sutil), success, warning, danger — accent bar `3px` lateral

---

## 🚀 Próximos passos

1. Pega o arquivo de uma tela (sugiro começar pelo **Dashboard** — maior ROI)
2. Abre no Claude Design e itera visual
3. Devolve o arquivo final
4. Eu implemento mantendo a lógica React/Supabase intacta
5. Tu valida no preview do Lovable
6. Passa pra próxima

**Não precisa fazer todas seguidas** — atacar 1-2 telas por sessão funciona bem.
