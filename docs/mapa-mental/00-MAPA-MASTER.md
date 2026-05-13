# 🧠 Mapa Mental do ERP Trevo — MASTER

> **Cobertura:** ~6.700 linhas de mapeamento clique-a-clique de todo o sistema ERP.
>
> **Geração:** 13/05/2026 noite, sessão autônoma 10h, 5 agents em paralelo + análises de gestor/visual.
>
> **Pedido original:** *"nova auditoria EXTREMAMENTE COMPLETA, literalmente como se fosse um mapa mental do meu sistema, o que acontece quando clica onde."*

---

## 📁 Os 7 docs

| # | Doc | Linhas | Cobertura |
|---|---|---|---|
| 01 | [`01-cliente.md`](01-cliente.md) | 1249 | Fluxo CLIENTE — `/clientes` lista + `/clientes/:id` 6 tabs + 13 modais + side-effects + 11 bugs/UX detectados |
| 02 | [`02-orcamento.md`](02-orcamento.md) | 1002 | Fluxo ORÇAMENTO — `/orcamentos` + `/orcamentos/novo` + `/proposta/:token` + `/cobranca/:token` + Sprint 2.A.4 |
| 03 | [`03-contas-pagar-cartao-colaboradores.md`](03-contas-pagar-cartao-colaboradores.md) | 1305 | Fluxo PAGAR — Despesas + Cartão + Folha automática + 11 guardrails + 24 hooks |
| 04 | [`04-financeiro.md`](04-financeiro.md) | 1476 | Fluxo FINANCEIRO — 3 abas + 5 RPCs atomicas + triggers + webhook Asaas + KPIs |
| 05 | [`05-config-auth-permissoes.md`](05-config-auth-permissoes.md) | 1130 | Fluxo CONFIG — Roles + permissions matrix + Gestão usuários + 2FA + 7 edge functions + SECs |
| 06 | [`06-features-gestor.md`](06-features-gestor.md) | 300 | 30 features novas priorizadas por ROI — mindset CEO/CFO |
| 07 | [`07-auditoria-visual.md`](07-auditoria-visual.md) | 266 | Estado visual + 10 problemas + 8 quick wins + 5 refactors amplos |

---

## 🎯 Por onde começar a ler

**Se tens 30 min:** lê `00-MAPA-MASTER.md` (este) + `06-features-gestor.md` (top 10 features que eu colocaria).

**Se tens 2h:** lê o resumo executivo abaixo + escolhe 1 doc baseado na frente que mais te interessa.

**Se tens 1 noite:** lê tudo — vai entender o sistema como nunca antes.

---

## 📊 Resumo executivo dos achados

### 🔴 Bugs reais ainda em aberto (já não cobertos pelos sprints)

| Doc | Bug | Severidade |
|---|---|---|
| 01-cliente | UX-014: nome contador às vezes não preenche em modal Edit | 🟡 médio |
| 01-cliente | UX-082: campo CNPJ máscara inconsistente entre modais | 🟡 médio |
| 01-cliente | UX-085: tipo cliente em modal vs ClienteDetalhe — opções diferentes | 🟡 médio |
| 02-orcamento | OrcamentoNovo: hasDetailedData heurística infere modo errado em alguns casos | 🟡 médio |
| 03-pagar | ContasPagar `corrigirDatasExistentes` corre 1x por sessão (não 1x por usuário/mês) | 🟢 polish |
| 03-pagar | Marcar Pago bulk: se 1 falha, os outros podem ter pago — sem rollback | 🔴 crítico (raro) |
| 04-financeiro | Trigger `_bloqueia_cobranca_sem_reembolso` pode bloquear silencioso em casos edge | 🟡 médio |
| 04-financeiro | "Contestar" não tem audit log do staff | 🟡 médio |
| 05-config | Webhooks salvos sem validação URL/teste | 🟡 médio |
| 05-config | Master pode editar próprias permissões → loop SEC | 🔴 médio |

### ⚫ Código morto / dívida técnica detectada

| Onde | LOC | Tipo |
|---|---|---|
| 01-cliente | `descontoPreview` calcula mesmo quando não usado | ~30 LOC |
| 02-orcamento | `cenarios` field ainda no banco mas zero UI/PDF render | banco + 0 LOC |
| 03-pagar | `cartaoNomeMap` rebuilt toda render | ~10 LOC |
| 04-financeiro | `mapLegacyTab` já removido (Sprint 1.2) | — |
| 05-config | Aba "Aparência" já removida (Sprint 1.3) | — |

### 🟡 UX confusos não cobertos pelos sprints

| Doc | UX | Sugestão |
|---|---|---|
| 01-cliente | Modal Editar tem 5 seções verticais sem indicação de "onde estou" | adicionar tabs ou stepper |
| 02-orcamento | Modo "detalhado" inferido por heurística, não explícito | toggle Simples/Detalhado |
| 03-pagar | Tab "Lista" aparece/desaparece — confunde quando filtrando | mantém sempre, com badge "filtrado" |
| 03-pagar | "Avisar Colaborador" modal pós-pagamento — muito click | considerar auto-envio se PIX salvo |
| 04-financeiro | KPI "Inadimplente" cor varia mas sem ícone — fácil ignorar | adicionar ⚠️ quando >0 |
| 05-config | Convidar Usuário tem 2 modos confusos (Email vs Senha direta) | wizard com explicação visual |

---

## 🎁 Features de gestor — TOP 5 que eu colocaria primeiro

(Vide doc 06 pro ranking completo)

1. **MRR Dashboard + Predição mensal** (3-4h)
2. **Recurring billing auto pra mensalistas** (4-5h) — elimina 1h/mês manual
3. **Lembretes Dani WhatsApp inteligentes** (3h) — reduz inadimplência
4. **"Hoje" view** (3h) — única tela com o que precisa fazer agora
5. **Notificações auto pro cliente** (2h) — eventos chave (deferimento, cobrança, pagamento)

---

## 🎨 Visual — sugestão minha

(Vide doc 07 pra detalhamento)

**Caminho mais barato (~8h):** 8 quick wins juntos
- Escala tipográfica documentada
- Empty state component
- KPI cards com identidade
- Cards "atenção" padronizados
- Botões consistentes
- Logo Trevo em mais lugares
- Skeleton loading uniforme
- Dark mode polish

**Caminho ideal (~25h):** 5 refactors amplos
- Design System doc + Storybook
- Migrar PropostaPublica/CobrancaPublica de CSS inline pra Tailwind
- Refactor visual completo Dashboard
- ClienteDetalhe visual rebuild
- /orcamentos lista visual rebuild

---

## 🚀 Próximas sessões sugeridas

**Sessão A — Receita/Caixa (8h):** TOP features 1, 2, 3 do gestor (MRR + Recurring + Lembretes Dani)
**Sessão B — Cliente experience (5h):** Features 4, 5 (Notif auto cliente + Hoje view)
**Sessão C — Visual polish (8h):** 8 quick wins do doc 07
**Sessão D — Bug sweep (4h):** Bugs médios/críticos da tabela acima
**Sessão E — Refactor god component ClienteDetalhe (5h):** A.3 deferido + visual rebuild

---

## 📌 Como manter este doc

- Quando entregar feature → atualizar respectivo doc do mapa
- Quando descobrir bug novo → adicionar na tabela "Bugs em aberto"
- Quando rejeitar feature do gestor (ex: PrepagoTab) → riscar com motivo
- Auditoria nova de outros perfis (gerente/operacional/visualizador) — ainda não feita

---

*Gerado em 13/05/2026 noite — sessão autônoma 10h enquanto Thales fora do escritório.*
