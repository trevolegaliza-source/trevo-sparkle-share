# AUDITORIA — Configurações, Relatórios & Trello

**Data:** 13/05/2026
**Escopo:** Configuracoes.tsx, RelatoriosDRE.tsx, RelatoriosFluxoCaixa.tsx, ReconciliacaoTrello.tsx

---

## 1. CONFIGURAÇÕES (`/src/pages/Configuracoes.tsx`)

### Layout/Abas (5 abas visíveis)

| Aba | Componente | Status | Observação |
|-----|-----------|--------|-----------|
| **Aparência** | Inline | ⚫ INÚTIL | Apenas exibe "Dark Mode exclusivo" — sem nenhuma ação possível. |
| **Usuários** (Master) | `GestaoUsuarios` | 🟢 NOVO | Refactor 13/05: dirty state, preview menu, badge SENSÍVEL. |
| **Segurança** | Inline + `TrocarSenhaCard` | 🟢 OK | Trocar senha (SEC-026), 2FA (MFA), Recovery codes. |
| **Webhooks** | Inline | 🟡 FRACO | 2 webhooks hardcoded sem validação/teste. |
| **Plano de Contas** | `PlanoContasTab` | 🟢 OK | CRUD hierárquico, 5 tipos. Funcional. |

### Achados

**⚫ INÚTIL**
- **Aba Aparência (linhas 223–240):** Renderiza card imutável "Tema Escuro" sem UI interativa. Puramente informativo — remover ou mover pra ajuda.

**🔴 BUG**
- **TrocarSenhaCard re-auth (linha 64):** Usa `signInWithPassword` pra validar senha atual. Sobrescreve JWT em memória — risco se falhar com erro de rede.

**🟡 UX RUIM**
- **Webhooks sem validação (linhas 190–197):** Salva URLs sem validar formato, sem testar conectividade, sem confirmar endpoint.
- **MFA obrigatório Master (linha 279):** Aviso em texto vermelho sem button "Configurar agora" inline.

---

## 2. RELATORIOS DRE (`/src/pages/RelatoriosDRE.tsx`)

### Layout
| Seção | Status | Observação |
|-------|--------|-----------|
| **Filtros** (4 select) | 🟡 OK | Centro custo limitado a 3 opções hardcoded |
| **KPIs** (4 cards) | 🟢 OK | Adequado |
| **Tabela DRE** | 🟢 OK | Renderiza com comparativo |
| **Export PDF** | 🟢 OK | Branding Trevo |

### Achados

**🟡 UX RUIM / ⚫ INÚTIL**
- **KPIs pobres (linhas 209–225):** 4 métricas fixas, DRE pode ter 20+ contas. Sem drill-down nos KPIs.
- **Centro de Custo filter inútil (linha 196–203):** Hardcoded 3 opções, dados inconsistentes (lançamentos legados sem centro).
- **Comparativo "Ano Anterior" retorna vazio (linha 232–235):** Sem aviso visual se 2025 não tem dados.

**🔴 BUG**
- **Filtro centro custo + KPIs (linhas 209–225):** Possível race entre estado local `centroCusto` e resultado. Verificar.

---

## 3. RELATORIOS FLUXO CAIXA (`/src/pages/RelatoriosFluxoCaixa.tsx`)

### Achados

**⚫ INÚTIL**
- **Gráfico 3 séries (linhas 136–163):** Renderiza entradas + saídas + saldo. Saldo = entradas - saídas → **redundante**.

**🟡 UX RUIM**
- **Switch "Incluir Recorrentes" sem contexto (linhas 50–57):** Sem badge "X recorrentes incluídos" ou breakdown.
- **Horizonte 30/60/90 sem "últimos 12 meses"** — falta visão anual.
- **Sem data inicial do saldo:** Tabela mostra projeção mas saldo atual não aparece.

---

## 4. RECONCILIACAO TRELLO (`/src/pages/ReconciliacaoTrello.tsx`)

### Achados

**🟡 UX RUIM**
- **Edge function sem logs de erro (linhas 102–127):** "Erro genérico" sem diferenciar 401/timeout/rate limit.
- **Matching fuzzy sem score (linhas 147–159):** `normalize() + includes()` pode gerar false positives.

**⚫ INÚTIL / 🔴 QUESTIONÁVEL**
- **Aba "Cards sem Processo" (linhas 308–424):** Mostra cards de boards reconciliados mas sem processo ERP. Fluxo invertido — ou cargo morto ou sinal de falta de treinamento.

**🔴 BUG / AUDITORIA**
- **Edge function filters hardcoded:** Ignora boards com prefixos `"INTERNO", "MODELO", "PROCESSOS DR.", "AUTOMAÇÃO"...`. Nenhuma log dos ignorados retornado ao frontend (só count).

---

## RESUMO ACHADOS

### ⚫ INÚTIL (3 itens recomendados deletar/refactor)
1. **Aba "Aparência"** — Configuracoes.tsx:223–240 (só informativo, sem ação)
2. **Série "Saldo"** gráfico Fluxo Caixa — RelatoriosFluxoCaixa.tsx:154–163 (redundante)
3. **Aba "Cards sem Processo"** Trello — ReconciliacaoTrello.tsx:308–424 (raro/inútil)

### 🔴 BUG (3 itens)
1. **TrocarSenha re-auth** pode quebrar sessão se falha (Configuracoes.tsx:64)
2. **DRE filter centro custo** pode não refletir em KPIs por race (RelatoriosDRE.tsx)
3. **Trello boards ignoradas** sem auditoria retornada ao frontend

### 🟡 UX RUIM (8 itens)
1. Webhooks sem validação URL/conectividade
2. MFA Master aviso sem "Configurar Agora" inline
3. DRE Centro Custo hardcoded 3 opções
4. DRE Comparativo vazio sem avisar
5. Fluxo Caixa gráfico poluído + falta saldo atual
6. Fluxo Caixa switch recorrentes sem indicador
7. Trello erro genérico sem retry
8. Trello matching fuzzy sem score/confirmação

---

## RECOMENDAÇÕES IMEDIATAS

| Prioridade | Ação | Estimativa |
|-----------|------|-----------|
| 🔴 CRÍTICA | Deletar aba Aparência | 5 min |
| 🔴 CRÍTICA | Remover série "Saldo" gráfico FluxoCaixa | 15 min |
| 🟡 ALTA | Auditar boards Trello ignoradas (retornar lista) | 30 min |
| 🟡 ALTA | Validação URL + teste Webhooks | 45 min |
| 🟡 ALTA | Reformular aba "Cards sem Processo" | 20 min |
| 🟢 MÉDIA | Matching score Trello | 1h |
| 🟢 MÉDIA | Saldo Atual KPI + contexto Recorrentes | 20 min |

---

**Auditor:** Claude Code · 13/05/2026
