# 🎯 Auditoria página-por-página — MASTER (13/05/2026)

> Auditoria do ERP perfil **master**, focada em **código inútil** + bugs + UX.
> Cobertura: ~18 telas em 7 grupos. **Não inclui** perfis secretária/operacional/gerente nem páginas públicas.
>
> **Última atualização: 13/05/2026 noite — sessão noturna fechada com 20+ commits.**

---

## 📊 Resumo executivo

| Categoria | Mapeado | Entregue | Pendente |
|---|---|---|---|
| 🔴 BUGs reais | 29 | **7 fixados** (Sprint 3) | 22 (UX-confuso, validações fracas) |
| 🟡 UX ruins | ~50 | **4 melhorias** (Sprint 4) | ~46 |
| ⚫ INÚTEIS (delete) | ~48 | **~1.700 LOC deletadas** | algumas frentes deferidas |
| 🟢 polish | ~15 | parcial | maioria |

**Highlights:**
- ✅ **~1.700 LOC removidas** (Documentos page, ClientesFinanceiroTab orphan 566L, Intel Geográfica 900L, etc)
- ✅ **dep `d3` removida** (60KB do bundle)
- ✅ **7 bugs reais corrigidos** (security tenant check, loop auto-folha, delete sem confirm, etc)
- ✅ **Fluxo automático cliente→Asaas** implementado (Sprint 2.A.4)
- ✅ **4 ajustes UX** entregues (Sprint 4)
- ⏸️ **A.3 deferido** (refactor god component OrcamentoNovo — sem valor visível, fica pra futuro)
- ⏸️ **UX-001/002 não atacados** (god components ClienteDetalhe 2549L etc — refactor amplo)

---

## ✅ ENTREGUE — Sprint 1 (delete óbvio)

| Item | Status | Commit |
|---|---|---|
| Página Documentos inteira (210 LOC) | ✅ | `3aaef88` |
| ClientesFinanceiroTab.tsx orphan (566 LOC) | ✅ | `3aaef88` |
| `mapLegacyTab()` 40 LOC + state `showFuturas` | ✅ | `3aaef88` |
| Aba "Aparência" Configurações + série "Saldo" gráfico | ✅ | `3aaef88` |
| Tab Observações ClienteDetalhe (consolidada no Edit Cadastro) | ✅ | `3aaef88` |
| `fmt()` centralizado em `/lib/format.ts` | ⏸️ **deferido** | 45 arquivos, refactor de massa arriscado |
| Feature pré-pago completa | ⏸️ **deferido** | 40+ refs, risco alto |

---

## ✅ ENTREGUE — Sprint 2 (decisões de produto)

| Letra | Frente | Decisão Thales | Status | Commit |
|---|---|---|---|---|
| A | 5 seções OrcamentoNovo (Cenários/Etapas/Riscos/Benefícios/Headline) | Deletar | ✅ Sprint 2.A.1 (-288 LOC) | `c816a3e` |
| A | `ordem_execucao` paralelo redundante | Deletar | ✅ Sprint 2.A.2 | `f3dbc0a` |
| A | Refactor god component OrcamentoNovo em sub-componentes | OK mas adiei | ⏸️ A.3 deferido | — |
| A | Fluxo automático "aprovar → cobrança Asaas" | OK | ✅ Sprint 2.A.4 (RPC + frontend + redirect) | `02b431f` |
| B | Mapa Brasil em Intel Geográfica | Deletar | ✅ junto com /inteligencia-geografica inteira | `37f7008` |
| C | Tab "Notas" EstadoDetalhe | Deletar | ✅ junto | `37f7008` |
| D | Rating ⭐ contatos | Deletar | ✅ junto | `37f7008` |
| E | PrecosUFModal Catálogo | Deletar | ✅ (-237 LOC) | `37f7008` |
| F | Aba "Cards sem Processo" Trello | Deletar | ✅ (-88 LOC) | `37f7008` |
| G | Mapa Municípios EstadoDetalhe | Deletar | ✅ junto com Intel Geográfica | `37f7008` |

**Total Sprint 2: -1.500 LOC + dep `d3` (60KB bundle).**

---

## ✅ ENTREGUE — Sprint 3 (bugs reais)

| ID | Bug | Status | Commit |
|---|---|---|---|
| 3.1 | SECURITY: desfazer pagamento sem tenant check no fallback | ✅ | `<b9df741`> |
| 3.2 | LOOP: auto-folha hash com `updated_at` (re-trigger infinito potencial) | ✅ | `b9df741` |
| 3.3 | DATA LOSS: Colaboradores delete sem confirmação | ✅ AlertDialog | `b9df741` |
| 3.4 | SESSÃO: TrocarSenha re-auth falha de rede → mensagem clara | ✅ parcial | `b9df741` |
| 3.5 | WhatsApp senha_link copiável | ⏸️ **deferido** (design intencional pra destinatário=contador) | — |
| 3.6 | PERFORMANCE: 6 queries SELECT COUNT em Orcamentos → 1 query | ✅ | `b9df741` |
| 3.7 | CONSISTÊNCIA: PrecosUFModal `Promise.allSettled` | ✅ (Modal depois deletado em 2.E) | `b9df741` |
| 3.8 | DATA: `mesesComCompras` null safety em CartaoDetalhe | ✅ | `b9df741` |

**Total Sprint 3: 7/8 bugs fixados, 1 deferido (decisão de design).**

---

## ✅ ENTREGUE — Sprint 4 (UX consolidação)

| Letra | Frente | Status | Commit |
|---|---|---|---|
| A | "Marcar Pago" no MoverParaMenu (redundante + sem tenant) | ✅ removido | `b4ff1fc` |
| B | Dashboard "Próximos Vencimentos" → abrir aba **Faturas** direto | ✅ | `b4ff1fc` |
| C | Auto-toast irritante "⏰ N despesas vencem em X dias" | ✅ removido | `b4ff1fc` |
| E | Mensalistas alerta amarelo (filtrar por dia_vencimento) | ✅ | `b4ff1fc` |
| D | Pipeline "Próximas faturas" Financeiro (info-only) | ⏸️ não atacado | — |
| F | "Gerar Verbas" wizard 6 cliques → 3 | ⏸️ não atacado (1h, sessão dedicada) | — |
| G | 2 UIs boas-vindas em Novo Processo | ⏸️ não atacado | — |

---

## ⏸️ PENDENTE — não atacáveis sem ti

| Frente | Por quê |
|---|---|
| **Smoke test A.4** (cobrança automática) | Tu testar em orçamento de teste |
| **Smoke tests carry-over tarde** (extrato real, marcar pago lote, etc) | Tu testar em prod |
| **TESTE FINANCEIRO** decisão | Limpar ou manter cliente fake? |
| **Paulo libera SPFBL** | Externo |
| **A11Y-002 contraste WCAG** | Sessão dedicada com devtools |
| **God components UX-001/UX-002** (ClienteDetalhe 2549L, ClienteAccordionFinanceiro 2300L) | Sessão dedicada com tu testando |
| **A.3 refactor OrcamentoNovo** | Deferido pelo próprio assistente (sem valor visível pra ti) |
| **Auditoria página-por-página outros perfis** (gerente/operacional/visualizador) | Tu definir escopo |

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
| 08 | [`08-fluxo-link-asaas.md`](08-fluxo-link-asaas.md) | Mapeamento do fluxo link interativo + integração Asaas (gerado pra Sprint 2.A.4) |

---

## 🧭 Próximos passos sugeridos

Quando tu voltar, em ordem:

1. **Publish no Lovable** (sobe ~20 commits da noite)
2. **Smoke test A.4 em orçamento de teste** (eu vou lembrar) — valida o fluxo automático cliente → Asaas
3. **Carry-over tarde:** 3 smoke tests pendentes (extrato real, marcar pago em lote, exclusão como secretária)
4. **Decisões pendentes:** TESTE FINANCEIRO, SPFBL Paulo
5. **Próxima sessão:** decidir entre:
   - Auditoria página-por-página outros perfis (escopo a definir)
   - God components refactor (UX-001/UX-002 — sessão dedicada, ele testando)
   - Atacar Sprint 4 D/F/G (UX remanescente)

---

**Estatísticas da sessão noturna 13/05:**
- 📦 **20+ commits** pushados em `main`
- 💀 **~1.700 LOC deletadas** (código morto/inútil)
- 🐛 **7 bugs reais** corrigidos
- ✨ **5 features novas** (Fase 3 enum etapa, A11Y-003 sweep, fluxo automático A.4, etc)
- 📦 **1 dep removida** (d3 — 60KB bundle)
- 🧹 **8 docs de auditoria** + 1 MASTER consolidado em `docs/auditoria-2026-05/`
