# 11 — Colaboradores (`/colaboradores`)

> Arquivo: `src/pages/Colaboradores.tsx` (330 linhas)

## 🎯 O que é

Folha de pagamento da empresa. Cadastro de colaboradores, valor DAS, avaliações.

**Permissão:** `modulo='colaboradores'`. **RLS no banco exige master OU financeiro** pra SELECT (verificado em ANEXO-A).

⚠️ **Inconsistência PERM-001:** template `financeiro` inclui `colaboradores`. Operador financeiro genérico vê salários de todos. Decisão de produto se isso é OK pra Trevo.

## 🗺️ Mapa

```
┌──────────────────────────────────────────────────────┐
│ Colaboradores                       [+ Novo Colab.] │
│ Stats: [Total] [Ativos] [Folha DAS R$X]              │
│                                                       │
│ Tabela: Nome | Cargo | DAS | Aumento previsto | [⋯] │
└──────────────────────────────────────────────────────┘
```

## 🔬 Achados

### Modal Detalhe
- Aba **Geral** — dados pessoais
- Aba **Financeiro** — DAS, plano de saúde, aumento previsto
- Aba **Avaliações** — performance reviews (`colaborador_avaliacoes` — 0 registros no banco hoje)

**Achado UX-113 🟢:** sistema de avaliações criado mas não usado. Decida: usar ou esconder.

### Aumento previsto
Coluna `aumento_previsto_valor` + `aumento_previsto_data`. UI mostra "🟡 Aumento em XX/XX". Master pode ver projeção.

**Achado UX-114 🟢:** quando data passa, deveria virar automático? Hoje fica "previsto" pra sempre. Cron job ou manual.

### Status
`ativo` / `inativo` / `férias` / `afastado` / etc.

## 🐛 Achados consolidados

| ID | Severidade | Resumo |
|---|---|---|
| **PERM-001** | 🟡 (mapeado) | Template financeiro vê colaboradores |
| **UX-113** | 🟢 | Avaliações criadas mas não usadas |
| **UX-114** | 🟢 | Aumento previsto não auto-aplica |

## 🚦 Verdict release

**🟢 GO** — Letícia/secretária NÃO vê esse módulo (só master). Sem risco amanhã.

Se for dar acesso a Letícia: `user_permissions` granular pra `colaboradores` (mas tens que decidir se ela vê salário do Thales).
