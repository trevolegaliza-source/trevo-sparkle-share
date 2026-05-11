# 🔍 Auditoria de Fluxo Completa — Trevo ERP

> **Disparada por Thales em 2026-05-11**, véspera do release pra Letícia (gestora) + secretária. Pedido: "audite o sistema como ele é usado no dia-a-dia. Pra cada tela, cada botão, cada interação: o que faz, o que deveria, o que polui, o que falta".

**Como ler isto:** comece pela seção **🚦 GO / NO-GO** abaixo. Cada tela tem um arquivo `.md` próprio com profundidade. Anexos no fim cobrem temas transversais (permissões, banco, edge functions, review).

---

## 🚦 GO / NO-GO — release amanhã (12/05/2026)

> Verdict por tela. **🔴 NO-GO** = bloqueia abertura pra Letícia/secretária. **🟡 ATENÇÃO** = libera, mas com nota explícita pros novos usuários. **🟢 GO** = pode liberar.

(Preenchido ao fim da auditoria. Última atualização do arquivo embaixo.)

| # | Tela / Área | Verdict | Bloqueadores |
|---|---|---|---|
| 01 | Navegação global (sidebar, logo, header) | ⏳ | ver doc |
| 02 | Login / Auth | ⏳ | |
| 03 | Dashboard | ⏳ | |
| 04 | Cadastro Rápido | ⏳ | |
| 05 | Clientes (lista) | ⏳ | |
| 06 | Cliente Detalhe (5+ abas) | ⏳ | |
| 07 | Processos (kanban + lista) | ⏳ | |
| 08 | Financeiro (4 abas) | ⏳ | |
| 09 | Contas a Pagar | ⏳ | |
| 10 | Cartões | ⏳ | |
| 11 | Colaboradores | ⏳ | |
| 12 | Orçamentos | ⏳ | |
| 13 | Cobrança Pública (cliente final) | ⏳ | |
| 14 | Proposta Pública | ⏳ | |
| 15 | Portfólio Público | ⏳ | |
| 16 | Configurações + Gestão Usuários | ⏳ | |
| 17 | Rotas órfãs (sem entrada no menu) | ⏳ | |

---

## 📚 Índice de arquivos

### Telas
- [`01-navegacao-global.md`](./01-navegacao-global.md) — Sidebar, logo, header, busca, atalhos
- [`02-login-auth.md`](./02-login-auth.md) — Login, recuperação, sessão
- [`03-dashboard.md`](./03-dashboard.md) — `/` (home)
- [`04-cadastro-rapido.md`](./04-cadastro-rapido.md) — `/cadastro-rapido`
- [`05-clientes-lista.md`](./05-clientes-lista.md) — `/clientes`
- [`06-cliente-detalhe.md`](./06-cliente-detalhe.md) — `/clientes/:id` (Financeiro/Serviços/Processos/Faturas/Contratos/Prepago/Obs)
- [`07-processos.md`](./07-processos.md) — `/processos`
- [`08-financeiro.md`](./08-financeiro.md) — `/financeiro` (A Fazer/Em Andamento/Histórico/Auditoria)
- [`09-contas-pagar.md`](./09-contas-pagar.md) — `/contas-pagar`
- [`10-cartoes.md`](./10-cartoes.md) — `/cartao`, `/cartao/:id`
- [`11-colaboradores.md`](./11-colaboradores.md) — `/colaboradores`
- [`12-orcamentos.md`](./12-orcamentos.md) — `/orcamentos`, `/orcamentos/novo`
- [`13-cobranca-publica.md`](./13-cobranca-publica.md) — `/cobranca/:token` (cliente final)
- [`14-proposta-publica.md`](./14-proposta-publica.md) — `/proposta/:token` (cliente final)
- [`15-portfolio-publico.md`](./15-portfolio-publico.md) — `/portfolio/:token` (cliente final)
- [`16-configuracoes.md`](./16-configuracoes.md) — `/configuracoes` (gestão de usuários inclusa)
- [`17-rotas-orfas.md`](./17-rotas-orfas.md) — `/processos-ativos`, `/faturamento`, `/documentos`, `/catalogo`, `/inteligencia-geografica`, `/relatorios/*`, `/reconciliacao-trello`

### Anexos transversais
- [`ANEXO-A-permissoes-rls.md`](./ANEXO-A-permissoes-rls.md) — 🚨 **Crítico release**. Mapa de roles, RLS, gaps de tenant isolation
- [`ANEXO-B-banco-saude.md`](./ANEXO-B-banco-saude.md) — Anomalias de dado (zombies, fantasmas, órfãos)
- [`ANEXO-C-edge-functions.md`](./ANEXO-C-edge-functions.md) — Mistério do `asaas-webhook/index.txt` resolvido
- [`ANEXO-D-code-review.md`](./ANEXO-D-code-review.md) — Re-review das 13 entregas de hoje
- [`ANEXO-E-personas.md`](./ANEXO-E-personas.md) — Mapa das 5 roles + sugestão de qual usar pra Letícia/secretária

---

## 🎯 Resumo executivo (preenchido no final)

(Lista TL;DR dos achados mais críticos da auditoria inteira)

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
        └─── tipo (plano):         ├── operacional:            ├── via /cobranca/:token
            mensalista, prepago,   │   etapa kanban (legado)   │   (link público)
            avulso, preco/tipo     │                           │
                                   └── financeiro:             ├── Asaas (PIX/boleto)
                                       aguardando_def. →       │
                                       solicitacao_criada →    └── manual (.txt)
                                       cobranca_gerada →
                                       cobranca_enviada →
                                       honorario_pago
```

---

## 📌 Convenções deste relatório

- **🔴** = bloqueia release / afeta dado / quebra fluxo
- **🟡** = incomoda no dia-a-dia, não bloqueia
- **🟢** = polish / nice-to-have
- **DECISION-001-relacionado** = nasce do problema do kanban operacional (registrado no AUDITORIA-GROTESCA principal)

IDs novos seguem o padrão das auditorias anteriores (UX-XXX, REL-XXX, FEAT-XXX, DATA-XXX). Todos ficam consolidados no `AUDITORIA-GROTESCA-TREVO-ERP.md` (raiz do repo) quando esta auditoria fechar.

---

**Última atualização:** _gerando…_
