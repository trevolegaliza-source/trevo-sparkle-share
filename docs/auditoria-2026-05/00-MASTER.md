# 🎯 Auditoria página-por-página — MASTER (13/05/2026)

> Auditoria do ERP perfil **master**, focada em **código inútil** + bugs + UX.
> Cobertura: ~18 telas em 7 grupos. **Não inclui** perfis secretária/operacional/gerente nem páginas públicas.

---

## 📊 Resumo executivo

| Categoria | Total | Onde dói mais |
|---|---|---|
| 🔴 BUGs reais | **29** | Financeiro (4), Contas/Cartão/Colab (8), Cliente (4), Orçamentos (4) |
| 🟡 UX ruins | **~50** | Espalhado |
| ⚫ **INÚTEIS (candidatos a delete)** | **~48** | OrcamentoNovo (290 LOC), Documentos page (210 LOC), ClientesFinanceiroTab orphan (566 LOC) |
| 🟢 polish | ~15 | Espalhado |

**TLDR — ROI maior:**
- 💀 **~1.700 LOC de código morto** pra deletar sem decisão de produto
- 🚨 **5 bugs com risco** (security/sessão/loop infinito) pra fixar logo
- ❓ **7 decisões de produto** pra tu desbloquear (Mapa Brasil? Tab Notas? etc)

---

## 🥇 SPRINT 1 — Delete óbvio (sem dor, sem decisão)

Coisa que tu nunca vai sentir falta. ~900 LOC pra eu deletar sem te perguntar.

| # | O que | Onde | LOC | Por quê |
|---|---|---|---|---|
| 1 | **Página Documentos inteira** | `/documentos`, `Documentos.tsx`, hooks | ~210 | Tabela `documentos` tem **0 registros**. Feature nunca usada. |
| 2 | **`ClientesFinanceiroTab.tsx` orphan** | `src/components/financeiro/` | **566** | Componente inteiro **não importado em lugar nenhum**. Código fantasma. |
| 3 | **`mapLegacyTab()` em Financeiro.tsx** | `Financeiro.tsx:34-41` | 40 | Mapeava abas antigas de 6 → 3 novas. Nenhuma navegação dispara. |
| 4 | **State `showFuturas` morto** | `Financeiro.tsx:77` | 1 | Declarado, nunca usado em JSX. |
| 5 | **Aba "Aparência" Configurações** | `Configuracoes.tsx:223-240` | 17 | Card imutável "Tema Escuro" sem ação. |
| 6 | **Série "Saldo" gráfico Fluxo Caixa** | `RelatoriosFluxoCaixa.tsx:154-163` | 10 | `Saldo = entradas − saídas` → redundante visualmente. |
| 7 | **`fmt()` redefinido em 3 arquivos** | ContasPagar, RecorrentesTab, Colaboradores | ~15 | Centralizar em `/lib/format.ts`. |
| 8 | **Comentários "Demanda Thales" resolvidos** | ContasPagar 118-159 + outros | ~30 | Mover pra histórico de commits. |
| 9 | **Tab Observações ClienteDetalhe** | `ClienteDetalhe.tsx:1442-1476` | ~35 | Duplica campo já editável no Edit Cadastro. |
| 10 | **PrepagoTab** (já decidiu "foda-se") | `PrepagoTab.tsx` + import condicional | ~150 | 0 clientes PRE_PAGO no banco. Tipo PRE_PAGO some do select de criação. |

**Total Sprint 1 ≈ 1.075 LOC deletadas. Mecânico. Zero decisão.**

**Posso atacar tudo agora se aprovar?**

---

## 🥈 SPRINT 2 — Decisões de produto (precisa tu)

Coisa que pode ser inútil mas requer tua palavra final.

| # | Frente | Decisão tua | LOC potencial |
|---|---|---|---|
| A | **5 seções OrcamentoNovo (Cenários, Etapas Fluxo, Riscos, Benefícios, Headline)** — 0-10% uso | Agrupar em collapse "Avançadas"? Ou deletar? | ~290 |
| B | **Mapa Brasil em `/inteligencia-geografica`** | Mostrar só SP (tu não tem cliente fora)? Ou manter como está? | ~150 |
| C | **Tab "Notas" em EstadoDetalhe** | 0 registros banco. Deleta? | ~60 |
| D | **Rating ⭐ em contatos_estado** | 0 ratings reais. Tu usa? | ~40 |
| E | **Preços por UF no Catálogo** | 0 registros banco. Modal de 54 inputs. Deleta? | ~120 |
| F | **Aba "Cards sem Processo" no Trello** | Cenário raro/nunca. Deleta? | ~115 |
| G | **Mapa Municípios em EstadoDetalhe** | Tu olha geográfico pra achar cartório? Ou sabe de cor? | ~200 |

**Total Sprint 2 ≈ 975 LOC. Tu manda na letra que aprovar.**

---

## 🥉 SPRINT 3 — Bugs reais (não-cosmético)

Coisa que pode quebrar/expor segurança/causar inconsistência.

| ID | Risco | Onde | Fix |
|---|---|---|---|
| 🔴-A | **SECURITY**: desfazer pagamento sem tenant check no fallback | `FinanceiroList.tsx:84-94` | Remover fallback, só usar RPC |
| 🔴-B | **LOOP**: auto-folha hash inclui `updated_at` → re-trigger infinito potencial | `ContasPagar.tsx:133-137` | Remover `updated_at` do hash |
| 🔴-C | **DATA LOSS**: deletar colaborador sem confirmação | `Colaboradores.tsx:293` | AlertDialog confirmação |
| 🔴-D | **SESSÃO**: TrocarSenha re-auth via `signInWithPassword` pode quebrar sessão se rede falhar | `TrocarSenhaCard.tsx:64` | Usar `auth.updateUser` direto |
| 🔴-E | **CONSISTÊNCIA**: PrecosUFModal upsert em loop sequencial sem error handling | `Catalogo.tsx:948-964` | `Promise.allSettled` + retry |
| 🔴-F | **DATA**: WhatsApp message inclui senha_link copiável | `Orcamentos.tsx:282` | Não interpolar senha em mensagem clipboard |
| 🔴-G | **PERFORMANCE**: 6 queries SELECT COUNT no Orcamentos a cada mudança de aba | `Orcamentos.tsx:45-58` | Calcular counts no array já carregado |
| 🔴-H | **DATA**: `mesesComCompras` quebra silenciosamente se `fatura_vencimento=null` | `CartaoDetalhe.tsx:92-97` | Filtrar null antes do groupBy |

**Total Sprint 3: 8 bugs reais. Posso atacar autônomo (sem risco de produto) — quer que ataque?**

---

## 🎨 SPRINT 4 — UX consolidação (precisa decisão)

| Frente | Onde | Recomendação |
|---|---|---|
| **3 caminhos "Marcar Pago"** (UX-015 inacabado) | Financeiro | Manter 1 button verde + dropdown Mais; deletar MoverParaMenu |
| **2 UIs boas-vindas em Novo Processo** | ClienteDetalhe | Excluir AlertDialog, deixar só card inline com toggle |
| **"Gerar Verbas" 6 cliques → wizard 3 cliques** | Colaboradores | Fundir GerarVerbasModal + ConfirmarDiasUteisModal |
| **Próximos Vencimentos no Dashboard** | Navega cliente, mas devia ir pra Faturas | Passar tab via state ou deletar do dash |
| **"Mensalistas sem fatura no mês" alerta amarelo** | Dashboard | Filtrar: só se passou dia do vencimento |
| **Pipeline "Próximas faturas" accordion** | Financeiro | Ou implementa ação (gerar extrato futuro) ou remove |
| **Modal contato pré-auditoria** | Financeiro Auditoria | Clarificar "opcional vs obrigatório" |
| **Auto-toast lembrete venc** | ContasPagar | Trocar por badge contador na aba |

---

## 📁 Index dos docs detalhados

| # | Doc | Conteúdo |
|---|---|---|
| 01 | [`01-dashboard.md`](01-dashboard.md) | Dashboard + ProcessosAtivosDetalhe + FaturamentoDetalhe |
| 02 | [`02-clientes.md`](02-clientes.md) | Clientes + ClienteDetalhe (2549L, 7 tabs, 13 modais) |
| 03 | [`03-financeiro.md`](03-financeiro.md) | Financeiro (3 abas) + ClientesAuditoria + FinanceiroList |
| 04 | [`04-contas-cartao-colaboradores.md`](04-contas-cartao-colaboradores.md) | ContasPagar + Cartao + CartaoDetalhe + Colaboradores |
| 05 | [`05-orcamentos-cadastro.md`](05-orcamentos-cadastro.md) | Orcamentos + OrcamentoNovo (1253L) + CadastroRapido |
| 06 | [`06-documentos-intel-catalogo.md`](06-documentos-intel-catalogo.md) | Documentos + IntelGeografica + EstadoDetalhe + Catalogo |
| 07 | [`07-config-relatorios-trello.md`](07-config-relatorios-trello.md) | Configuracoes + RelatoriosDRE + RelatoriosFluxoCaixa + ReconciliacaoTrello |

---

## 🎯 Próximos passos sugeridos

**Tu manda em ordem:**
1. **Sprint 1** (Delete óbvio, ~1075 LOC) — eu ataco autônomo, tu só Publish depois
2. **Sprint 3** (Bugs reais, 8 fixes) — eu ataco autônomo, tu Publish
3. **Sprint 2** (Decisões A-G) — tu responde A/B/C... e eu executo
4. **Sprint 4** (UX consolidação) — uma frente por vez, depende de tua palavra

**Estimativa real:**
- Sprint 1: 2-3h (eu) + Publish (tu)
- Sprint 3: 3-4h (eu) + Publish (tu)
- Sprint 2: depende das tuas respostas
- Sprint 4: depende das tuas respostas

**Permissão pra atacar Sprint 1 + Sprint 3 autônomo?** Cada delete vira commit pequeno, dá rollback se quiser.
