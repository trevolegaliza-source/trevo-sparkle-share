# Trevo Legaliza — ERP

ERP multi-tenant da **Trevo Legaliza** para gestão de processos, clientes,
financeiro, orçamentos, propostas e contratos. Construído com Lovable.dev
sobre React + TypeScript + Vite + shadcn/ui, com backend Supabase
(Postgres + RLS + Edge Functions + Storage + Realtime).

> Produção: <https://app.trevolegaliza.com>

---

## Stack

| Camada      | Tecnologia                                                      |
|-------------|-----------------------------------------------------------------|
| Build       | Vite 5 + SWC                                                    |
| UI          | React 18, shadcn/ui (Radix), TailwindCSS 3, lucide-react        |
| Estado      | TanStack Query 5, React Hook Form + Zod                         |
| Backend     | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)    |
| Tipagem     | TypeScript 5                                                    |
| Testes      | Vitest + Testing Library + Playwright (e2e)                     |
| Lint        | ESLint 9 (typescript-eslint) + react-hooks                      |
| Deploy      | Lovable.dev (build automático no push para `main`)              |

## Pré-requisitos

- **Node.js 18+** (Vite 5 não roda em Node 14)
- npm 9+

## Setup

```bash
git clone https://github.com/trevolegaliza-source/trevo-sparkle-share.git
cd trevo-sparkle-share
npm install
npm run dev          # http://localhost:8080
```

## Scripts

| Comando             | O que faz                                  |
|---------------------|--------------------------------------------|
| `npm run dev`       | Servidor Vite em modo dev                  |
| `npm run build`     | Build de produção                          |
| `npm run build:dev` | Build em modo desenvolvimento (sourcemaps) |
| `npm run preview`   | Preview do build                           |
| `npm run lint`      | ESLint sobre o repo                        |
| `npm run test`      | Testes unitários (Vitest, run once)        |
| `npm run test:watch`| Vitest em watch                            |

Typecheck rápido sem build: `npx tsc --noEmit`.

## Estrutura

```
src/
  components/        # Componentes (ui/ = shadcn primitives)
  hooks/             # React Query hooks (useFinanceiro, useClientes, ...)
  integrations/
    supabase/        # Client + types gerados
  lib/               # Utilitários puros (cnpj.ts, storage-path.ts, ...)
  pages/             # Rotas (React Router)
supabase/
  functions/         # Edge Functions (Deno) — webhooks, integrações
  migrations/        # Migrations SQL versionadas
```

## Multi-tenancy

Cada usuário pertence a uma `empresa_id`, resolvida no Postgres pela function
`get_empresa_id()` e propagada para policies RLS em todas as tabelas e buckets.
**Toda nova tabela precisa de RLS habilitado e policies por empresa.**

No frontend, o helper `getEmpresaId()` em [src/lib/storage-path.ts](src/lib/storage-path.ts)
faz cache do valor por sessão e é usado para montar paths de upload.

## Edge Functions

Implantadas em `supabase/functions/`. Notáveis:

- `asaas-webhook` — recebe eventos de cobrança do Asaas, valida token
  (`ASAAS_WEBHOOK_TOKEN`) e atualiza `lancamentos`.
- demais funções: ver `supabase/functions/`.

URL de produção:
`https://aahhauquuicvtwtrxyan.supabase.co/functions/v1/<nome-da-function>`.

## Deploy

Push para `main` dispara build automático no **Lovable.dev**.
Domínio personalizado configurado via TXT `_lovable.app` no Hostinger
+ A record `app → 185.158.133.1`.

## Suporte / Contato

CEO: Thales Burger — Trevo Legaliza.
