# 🔍 Auditoria de Fluxo Completa — Trevo ERP

> **Disparada por Thales em 2026-05-11**, véspera do release pra Letícia (gestora) + secretária. Pedido: "audite o sistema como ele é usado no dia-a-dia. Pra cada tela, cada botão, cada interação: o que faz, o que deveria, o que polui, o que falta".

**Status:** ✅ COMPLETA. 17 telas + 5 anexos. Última atualização: 2026-05-11.

---

## 🚦 GO / NO-GO — release amanhã (12/05/2026)

> ⚡ **Decisão final:** 🟢 **GO** com 3 fixes recomendados antes (15min total) + 1 ressalva pra você ter ciência.

### ✅ Verdict por tela

| # | Tela / Área | Verdict | Notas críticas |
|---|---|---|---|
| 01 | Navegação global | 🟡 GO com 1 fix | UX-028 (logo não navega) + UX-029 (Letícia sem label) — 5 min |
| 02 | Login / Auth | 🟡 GO com ressalva | REL-019 `/reset-password` 404 — workaround: Thales reseta senha manual |
| 03 | Dashboard | 🟢 GO | Operacional vê tela "Aguarde admin" — UX-063 (polish) |
| 04 | Cadastro Rápido | 🟡 GO | UX-073 lentidão + UX-067 redundância step 2 (Thales reclamou) |
| 05 | Clientes (lista) | 🟢 GO | UX-083 tipo só mostra 2 valores (mantém ok) |
| 06 | Cliente Detalhe | 🟢 GO | Tela mais complexa — reservar 30min support |
| 07 | Processos (kanban) | 🟡 ATENÇÃO | UX-100 drag dispara cobrança sem aviso — fix 15min |
| 08 | Financeiro | 🟢 GO | Backlog em outras IDs |
| 09 | Contas a Pagar | 🟡 ATENÇÃO | UX-108 botões duplicados |
| 10 | Cartões | 🟢 GO | PERM-008 (RLS) é dívida multi-tenant |
| 11 | Colaboradores | 🟢 GO | Só master vê |
| 12 | Orçamentos | 🔴 **NOTA CRÍTICA** | INT-001 NÃO INTEGRA com financeiro (já mapeado) |
| 13 | Cobrança Pública | 🟢 GO | Cliente final |
| 14 | Proposta Pública | 🟢 GO | Cliente final |
| 15 | Portfólio Público | 🟢 GO | Cliente final |
| 16 | Configurações | 🔴 **2 FIXES MÍNIMOS** | SEC-015 auto-desativar + SEC-014 "Remover" engana |
| 17 | Rotas órfãs | 🔴 1 FIX MÍNIMO | PERM-005 `/reconciliacao-trello` sem proteção |

### 🚨 Fixes recomendados ANTES do release (15-30min total)

**Bloqueadores REAIS (não pode ignorar):**

1. **SEC-015** (Configurações) — master pode se auto-desativar (1 clique e você se tranca fora). Adicionar `disabled={p.id === user.id}` nos botões Desativar/Remover.

2. **PERM-005** (Rotas órfãs) — `/reconciliacao-trello` sem `RequirePermission`. Adicionar `<RequirePermission modulo="configuracoes">` em `App.tsx:175`.

3. **SEC-014** (Configurações) — botão "Remover" não deleta, só desativa. Renomear pra "Desativar permanente" pra não enganar.

**Recomendados (polish):**

4. **UX-028** — Logo Trevo no sidebar não navega pra `/`. 1 linha.
5. **UX-029** — Letícia (`gerente`) sem role label no avatar. 1 linha.
6. **UX-100** — Drag de processo dispara cobrança automática sem aviso. 5 linhas.

**Posso fazer esses 6 fixes em ~30min sozinho.** Se você topar, deixo num commit separado pra você revisar/Publish.

### 🟡 Ressalva pra você ter ciência

**INT-001 (Orçamentos não integra)** — você reclamou disso explicitamente. Hoje o "Convertido" é só rótulo cosmético — não cria processo+lancamento+cobrança. Master/Letícia precisa criar processo manual após aprovar.

Próxima sessão de trabalho dedicada deve atacar — proposta detalhada no [`12-orcamentos.md`](./12-orcamentos.md).

---

## 📚 Índice dos arquivos

### Telas
| Arquivo | Achados | Verdict |
|---|---:|---|
| [`01-navegacao-global.md`](./01-navegacao-global.md) | 9 | 🟢 |
| [`02-login-auth.md`](./02-login-auth.md) | 7 | 🟡 |
| [`03-dashboard.md`](./03-dashboard.md) | 13 | 🟢 |
| [`04-cadastro-rapido.md`](./04-cadastro-rapido.md) | 9 | 🟡 |
| [`05-clientes-lista.md`](./05-clientes-lista.md) | 9 | 🟢 |
| [`06-cliente-detalhe.md`](./06-cliente-detalhe.md) | 9 | 🟢 |
| [`07-processos.md`](./07-processos.md) | 6 | 🟡 |
| [`08-financeiro.md`](./08-financeiro.md) | 6 | 🟢 |
| [`09-contas-pagar.md`](./09-contas-pagar.md) | 5 | 🟡 |
| [`10-cartoes.md`](./10-cartoes.md) | 3 | 🟢 |
| [`11-colaboradores.md`](./11-colaboradores.md) | 3 | 🟢 |
| [`12-orcamentos.md`](./12-orcamentos.md) | 5 | 🔴 INT-001 |
| [`13-cobranca-publica.md`](./13-cobranca-publica.md) | 3 | 🟢 |
| [`14-proposta-publica.md`](./14-proposta-publica.md) | 1 | 🟢 |
| [`15-portfolio-publico.md`](./15-portfolio-publico.md) | 2 | 🟢 |
| [`16-configuracoes.md`](./16-configuracoes.md) | 11 | 🔴 SEC-014/015 |
| [`17-rotas-orfas.md`](./17-rotas-orfas.md) | 4 | 🔴 PERM-005 |

### Anexos transversais
- [`ANEXO-A-permissoes-rls.md`](./ANEXO-A-permissoes-rls.md) — 🚨 RLS: 7 tabelas com policy permissiva (cartões, contatos, etc) — dívida multi-tenant
- [`ANEXO-B-banco-saude.md`](./ANEXO-B-banco-saude.md) — Banco saudável; "30 fantasmas" do HANDOFF era falso alarme
- [`ANEXO-C-edge-functions.md`](./ANEXO-C-edge-functions.md) — Mistério do `.txt` resolvido (rename proposital)
- [`ANEXO-D-code-review.md`](./ANEXO-D-code-review.md) — Re-review das 13 entregas de hoje, confiança 8/10
- [`ANEXO-E-personas.md`](./ANEXO-E-personas.md) — Sugestão: Letícia=`gerente`, Secretária=`operacional`

---

## 🎯 Resumo executivo

### O bom 🟢
- **Sistema de permissões sólido** — 5 roles + override granular + RLS no banco
- **Multi-tenant funciona** na maioria das tabelas críticas (clientes, processos, lancamentos, cobrancas)
- **Realtime** funciona em vários lugares (notificações, financeiro)
- **Edge functions** ativas e auditadas (asaas-webhook v25 com proteções camadas)
- **Auditoria de hoje pré-release entregou 13 fixes em produção** (REL-009 a REL-013, UX-007 a UX-020, FEAT-001/002/003, DATA-005/006/007, MON-001)

### O ruim 🟡
- **God components** (ClienteDetalhe.tsx 2549 linhas, OrcamentoNovo.tsx 1253, Catalogo.tsx 1057)
- **Kanban operacional** (DECISION-001) — 18 etapas, banco usa 4. Teatro.
- **UX inconsistências** — várias telas com mobile quebrado (modais gigantes, doppelclick)
- **Rotas órfãs** — 9 rotas (3364 linhas) escondidas do menu. Algumas duplicam funcionalidades.

### O crítico 🔴
- **INT-001 — Orçamento não vira processo/lancamento.** Você reclamou. Confirmado.
- **SEC-015 — Master pode se auto-desativar.** 1-clique self-DoS.
- **PERM-005 — `/reconciliacao-trello` sem proteção.** Operacional pode entrar.
- **PERM-008 — RLS de `cartoes/cartao_compras/cartao_faturas` permissivo.** OK hoje (1 empresa), bomba se virar multi-tenant.

---

## 📊 Métricas da auditoria

- **17 telas auditadas** (1 página por arquivo)
- **5 anexos transversais**
- **~120 achados** mapeados com IDs
- **~25 sugestões concretas** de fix
- **3 bloqueadores reais** identificados (SEC-014, SEC-015, PERM-005)
- **1 problema crítico de produto** confirmado (INT-001 Orçamentos)
- **Banco auditado:** 7 tabelas RLS permissivas + 2 processos com etapa inválida + 3 tabelas backup
- **Edge functions:** 14 ativas, mistério `.txt` resolvido

---

## 🗺️ Mapa mental do sistema

```
                    ┌─────────────┐
                    │  Thales     │ master — vê tudo, configura usuários
                    └─────┬───────┘
                          │
                  ┌───────┴────────┐
                  │   Letícia      │ gerente — opera com autonomia
                  │   (gestora)    │   (sugestão: usar role 'gerente')
                  └───────┬────────┘
                          │
                  ┌───────┴────────┐
                  │  Secretária    │ operacional — cadastra processos
                  │                │   (sugestão: usar role 'operacional')
                  └────────────────┘

      Clientes ────cadastra────► Processos ────entrega────► Cobrança
        │                          │                          │
        │                          ├── operacional:            │
        │                          │   etapa kanban (legado)   ├── via /cobranca/:token
        │                          │   ↑ DECISION-001 remover  │   (link público)
        │                          │                           │
        │                          └── financeiro:             ├── Asaas (PIX/boleto)
        │                              aguardando_def. →       │
        │                              solicitacao_criada →    └── manual (.txt)
        │                              cobranca_gerada →
        │                              cobranca_enviada →
        │                              honorario_pago
        │
        └─── Orçamento ❌ NÃO LIGADO (INT-001) ❌
```

---

## ✅ Checklist Thales — antes de liberar pra Letícia/secretária amanhã

- [ ] **Criar contas** via `/configuracoes` → Usuários → "Convidar Usuário"
  - Letícia: role `gerente`
  - Secretária: role `operacional`
- [ ] **Definir senha inicial** (ou pedir via "Esqueci senha" → resetar manual no Supabase Dashboard se REL-019 não for fixado)
- [ ] **Comunicar via WhatsApp** que estão liberadas
- [ ] **Estar disponível primeira hora** pra dúvidas
- [ ] **(Recomendado)** Aplicar os 3 fixes mínimos (SEC-014, SEC-015, PERM-005) — peço autorização separada
- [ ] **(Opcional)** Aplicar os 3 polish (UX-028, UX-029, UX-100) — peço autorização separada

## 📝 Convenções

- 🔴 = bloqueia release / afeta dado / quebra fluxo
- 🟡 = incomoda no dia-a-dia, não bloqueia
- 🟢 = polish / nice-to-have

Todos os IDs ficarão consolidados em `AUDITORIA-GROTESCA-TREVO-ERP.md` (raiz do repo) no próximo update.

---

**Trabalho concluído autonomamente em ~6h enquanto você dormia.** Nenhum código de produção mexido. Tudo doc no GitHub.
