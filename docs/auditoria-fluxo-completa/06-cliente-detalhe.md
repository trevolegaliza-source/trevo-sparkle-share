# 06 — Cliente Detalhe (`/clientes/:id`)

> Arquivo: `src/pages/ClienteDetalhe.tsx` (2549 linhas — **god component**)

## 🎯 O que é

Tela central de operação por cliente. 6 ou 7 abas (depende se é PRE_PAGO). Quase tudo que se faz no dia-a-dia passa aqui: configurar parâmetros, cadastrar processo, gerar extrato/cobrança, marcar pago, ver histórico.

**Permissão:** `modulo='clientes'`.

## 🗺️ Mapa de abas

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Voltar     CLIENTE NOME                  [⋯ Ações]             │
│              CNPJ · Tipo · Contador                              │
├──────────────────────────────────────────────────────────────────┤
│ KPI: Total | Ativos | Faturado | Pendente                        │
├──────────────────────────────────────────────────────────────────┤
│ ⚙ Financeiro │ 📋 Serviços │ 📄 Processos │ $ Faturas (3🔴) │  │
│   📑 Contratos │ 💲 Pré-Pago (se aplicável) │ 📝 Obs.            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│           (conteúdo da aba ativa)                                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

UX-010 (fix de hoje) garante que aba atual é preservada após mutações. ✅

## 🔬 Aba 1: ⚙ Financeiro (default)

Parâmetros financeiros do cliente. Modo leitura → botão "Editar Parâmetros" → modo edição → "Salvar".

Campos visíveis (variam por tipo):
- **Todos:** Tipo de Cliente, Momento do Faturamento (`na_solicitacao` / `no_deferimento`), Dia da Cobrança
- **MENSALISTA:** Mensalidade, Franquia, Vencimento, Valor Base (excedente), Desconto Progressivo %
- **AVULSO_4D:** Valor Base, Desconto Progressivo %, Mín. desconto
- **PRE_PAGO:** Saldo, Valor da última recarga (não editável aqui — UX-023)
- **PRECO_POR_TIPO:** lista de preços por tipo (gerenciada em sub-componente)

**Achado UX-091 🟡:** ao mudar `tipo` (Mensalista ↔ Avulso ↔ Pré-Pago ↔ Preço por tipo), campos antigos podem ficar com valor "fantasma" no banco (ex: era Mensalista com `franquia_processos=5`, vira AVULSO_4D — `franquia_processos` continua 5). Não causa bug visível mas suja o dado.

**Achado UX-092 🟢:** edit não tem confirmação. Mudar `mensalidade` de R$200 pra R$2000 acidental e salvar — passou. Considere confirmação se valor varia >50%.

**Achado UX-093 🟢:** sub-componente `ServicosPreAcordados` (na aba "Serviços") permite preço fixo por serviço — overlap conceitual com `PRECO_POR_TIPO`. Pode confundir master ("qual usar?").

## 🔬 Aba 2: 📋 Serviços

Lista de "serviços pré-acordados" + negociações. Permite criar tabela de preços específica do cliente.

**Achado UX-093 🟡:** confusão semântica.
- "Serviço pré-acordado" (aqui)
- "Preço por tipo" (config do cliente)
- "Valor manual" no cadastro do processo
- "Negotiation" via `service_negotiations`

4 maneiras diferentes de "fixar preço diferente do padrão". Reduzir a 2 (one for type-based, one for ad-hoc). Refactor médio.

## 🔬 Aba 3: 📄 Processos

Tabela de processos do cliente.

Linhas 1019-1129 (já analisado em UX-010/FEAT-001):
- Checkbox de seleção
- Razão Social + ícone ✓ se pago + nome riscado se pago
- Tipo + badges (Avulso, Plano)
- Etapa (mostra "Concluído" se pago, senão `KANBAN_STAGES.label` — DECISION-001-rel)
- Pagamento (PagamentoBadge: pago / vencido / aguardando)
- Prioridade (badge se urgente)
- Data (created_at formatado)
- Valor + ✓ Pago se pago
- **Ações (coluna):**
  - 🟢 Check verde "Marcar deferido" (FEAT-002) — só se cliente `no_deferimento` + lanc `aguardando_deferimento`
  - 🟡 Undo amarelo "Desfazer deferimento" (FEAT-003) — só se data_deferimento + lanc não enviado/pago
  - 🟩 CheckCircle verde "Marcar pago" (FEAT-001) — só se !pago
  - ⚙ Settings cinza "Editar config" — sempre

**Botões de cabeçalho:**
- "Novo Processo" → modal grande (linha 1700+)
- "Selecionar todos" checkbox
- Ações em lote: gerar relatório, gerar extrato, marcar faturado, etc

**Achado UX-076 🟡 (DECISION-001-rel):** coluna "Etapa" mostra kanban operacional. Desaparece quando DECISION-001 atacar.

**Achado UX-094 🟢:** doppelclick (linha 1047) abre `ProcessoEditModal`. Mesmo problema mobile do UX-082 (Clientes lista).

**Achado UX-095 🟡:** botão "Gerar Cobrança" (renomeado pra "Baixar resumo .txt" no UX-011 de hoje) e botão "Gerar Extrato" coexistem. Ainda confunde — primeiro só baixa, segundo cria cobrança real. **Sugestão pos-release:** mover o botão "Baixar resumo" pra dentro de "⋯ Mais ações" pra desambiguar.

## 🔬 Aba 4: $ Faturas

Sub-seções:
- **Mensalista sem fatura no mês** (banner amarelo, se aplicável)
- **Aguardando Auditoria** (lançamentos com `auditado=false`)
- **Auditados — Prontos para cobrar**
- **Em cobrança / Enviadas**
- **Pagas / Histórico**

Cada subseção é uma mini-tabela com ações específicas:
- "Auditar" (audita lançamento)
- "Gerar extrato" (do selecionado)
- "Marcar pago" / "Desfazer pago"
- "Devolver pra auditoria"

**Achado UX-020 (já fixado hoje):** "Gerar Fatura Mensal" não navega mais pra /financeiro. ✅
**Achado UX-014 (mapeado, não atacado):** dialog "Marcar Faturado" usa `selectedProcessosTab` desincronizado com `procsToGenerate`.

## 🔬 Aba 5: 📑 Contratos

Lista de PDFs anexados (Storage bucket `contratos`). Upload via dropzone. Preview/Download/Delete por item.

**Achado UX-096 🟢:** sem versionamento. Re-anexar substitui? Cria 2 entradas? Confuso.

**Achado SEC-016 🟢:** `signedUrl(storagePath, 3600)` (1h). Se user gerar e copiar URL, qualquer um com URL acessa por 1h. Tradeoff aceitável.

## 🔬 Aba 6: 💲 Pré-Pago (só se `tipo='PRE_PAGO'`)

Mostra saldo atual. **NÃO mostra histórico de movimentações** (UX-023 já mapeado).

**Achado UX-023 🟡 (já mapeado):** sem UI de recarga/débito + sem lista de `prepago_movimentacoes`. Saldo editado via input no form de edit cadastro — perde histórico.

## 🔬 Aba 7: 📝 Observações

Textarea simples. Salva direto na coluna `clientes.observacoes`.

**Achado UX-097 🟢:** sem versionamento de mudanças. Quem editou? Quando? Nada disso visível. OK pra MVP.

## 🔬 Ações no header (botão ⋯)

(linha 2080-2110)
- Arquivar (com password)
- Desarquivar
- Excluir definitivo (com password)
- Gerar Relatório (PDF)

**Achado UX-098 🟢:** `Arquivar` é a ação default — bom. `Excluir definitivo` (purge) é raro e protegido. Boa hierarquia.

## 🐛 Bugs / Inconsistências (consolidados)

| ID | Severidade | Resumo |
|---|---|---|
| **UX-091** | 🟡 | Mudar tipo deixa campo fantasma no banco |
| **UX-092** | 🟢 | Sem confirm em mudança grande de valor |
| **UX-093** | 🟡 | 4 jeitos de fixar preço (overlap conceitual) |
| **UX-094** | 🟢 | doppelclick mobile-unfriendly (idem UX-082) |
| **UX-095** | 🟡 | "Gerar Cobrança" (txt) e "Gerar Extrato" muito perto |
| **UX-096** | 🟢 | Sem versionamento de contratos |
| **UX-097** | 🟢 | Sem audit log de observações |
| **UX-098** | 🟢 | Header actions OK (arquivar default + delete protegido) |
| **SEC-016** | 🟢 | signedUrl 1h aceita compartilhamento |

## 🎨 Poluição visual

🔴 **`ClienteDetalhe.tsx` é god component (2549 linhas).** Toda lógica de 7 abas + 5 modais + 8 dialogs num só arquivo. Manutenção é dolorosa. Auditoria sistêmica de 07/05 já flagou (PERF-002 — refactor pesado, ROI baixo até bug forçar). Decisão Thales: não atacar agora.

🟡 Aba "Faturas" tem 4 subseções verticais. Em mobile vira scroll infinito sem ancoragem. Considere sub-tabs internas (Aguardando / Cobrando / Pagas).

## 🚦 Verdict release amanhã

**🟢 GO** — funciona pra master/gerente/operacional. Letícia (gerente) vai usar essa tela 60% do tempo. Os achados são UX iterável, não bugs travando uso.

**Nota:** Tela MAIS COMPLEXA do sistema. Se rolar bug em produção amanhã, provavelmente é aqui. Reserve 30min de support pra Letícia no primeiro dia.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **UX-091** | Mudança de tipo deixa campos fantasma |
| **UX-092** | Edit sem confirm de mudança grande |
| **UX-093** | 4 mecanismos de preço (overlap) |
| **UX-094** | doppelclick mobile (= UX-082) |
| **UX-095** | "Cobrança" txt e "Extrato" real confundem |
| **UX-096** | Contratos sem versionamento |
| **UX-097** | Observações sem audit log |
| **UX-098** | (✅ OK) Header actions bem desenhadas |
| **SEC-016** | signedUrl 1h compartilhável |

## 📚 Referências internas

Esta tela já recebeu intervenções pesadas hoje:
- UX-007: scroll do sino (em outra tela, mas mesma arquitetura)
- UX-010: tabs preservadas após refresh
- FEAT-001/002/003: marcar/desfazer pago e deferido
- DERMAE: anti-rebaixamento de honorario_pago em 4 caminhos

Próximas intervenções aqui devem **considerar refactor parcial** antes — extrair abas em componentes próprios. Ver PERF-002 na auditoria sistêmica.
