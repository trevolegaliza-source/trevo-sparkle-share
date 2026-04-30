# Auditoria noturna — 30/04/2026

Sessão autônoma enquanto o Thales dormiu. Foco: itens críticos que dava
pra fechar sem testar UI manual nem mexer em código de produção
sensível (cobranças/Asaas/auth).

## Resumo

| Lote | Itens                          | Commits | Risco         |
|------|--------------------------------|---------|---------------|
| C    | C25, C26, C21                  | 6f10352 | Zero          |
| A    | C9, C8, C10, C6                | 6eb1a31 | Baixo         |
| B/D  | C19+C20, C16                   | 2fd5f28 | Baixo         |
| —    | C23                            | 75504d3 | Zero          |

Todos os commits passaram `npx tsc --noEmit` localmente (Node 14
não roda Vite, build real fica para o Lovable / GitHub Actions).

## Detalhes

### C25 — README ([README.md](README.md))
Substituído o placeholder do Lovable por documentação real: stack,
pré-requisitos, scripts, estrutura de pastas, modelo multi-tenant,
edge functions e como deploy funciona.

### C26 — CI ([.github/workflows/ci.yml](.github/workflows/ci.yml))
Workflow `CI` rodando em push para `main` e em PRs. Passos:
1. `npm ci`
2. `npm run lint` (continua mesmo com warnings)
3. `npx tsc --noEmit` (bloqueia se quebrar)
4. `npm run test` (continua mesmo se falhar enquanto cobertura é baixa)
5. `npm run build` (bloqueia se quebrar)

Node 20. `permissions: contents: read` para princípio do menor
privilégio.

### C21 — NotFound em PT-BR ([src/pages/NotFound.tsx](src/pages/NotFound.tsx))
- Texto traduzido (era "Oops! Page not found").
- Mostra a rota tentada para feedback de UX.
- Dois botões: **Voltar** (`navigate(-1)`) e **Ir para o Dashboard** (`/`).
- Usa shadcn `Button` + `lucide-react`.

### C9 — CNPJ mod-11 ([src/lib/cnpj.ts](src/lib/cnpj.ts))
Antes: `isValidCNPJ` aceitava qualquer string com 14 dígitos
(inclusive `00000000000000`).

Agora:
- Implementa o algoritmo oficial dos dígitos verificadores
  (pesos 5,4,3,2,9,8,7,6,5,4,3,2 e 6,5,4,3,2,9,8,7,6,5,4,3,2).
- Rejeita sequências repetidas (`11111111111111` etc.).
- Adicionei `hasCNPJLength` para a máscara progressiva
  (que ainda precisa aceitar comprimento sem DV durante digitação).
- Cobertura: [src/lib/cnpj.test.ts](src/lib/cnpj.test.ts).

> Impacto: cadastros novos com CNPJ inválido passam a ser rejeitados.
> Cadastros antigos no banco continuam exibindo normalmente
> (`formatCNPJ` só checa comprimento).

### C8 — Timezone em vencidos ([src/hooks/useFinanceiroClientes.ts](src/hooks/useFinanceiroClientes.ts))
Antes: misturava `new Date()` com `setHours(0,0,0,0)` (local) e
`new Date(data + 'T00:00:00')` — funcional mas frágil.

Agora: comparação como string `YYYY-MM-DD`. Funciona em qualquer
timezone, é determinístico, e zero ambiguidade de UTC×local.

### C10 — NaN guard ([src/hooks/useFinanceiro.ts](src/hooks/useFinanceiro.ts))
`calcularDescontoProgressivo` agora:
- Trata `valorBase` NaN/negativo como 0.
- Clampa `descontoPercent` para [0, 100].
- Garante `processosNoMes` >= 0 inteiro.
- `valorFinal` final passa por `Number.isFinite` antes de retornar.

Sem isso, um valor base inválido vindo do form podia gravar `NaN`
em `lancamentos.valor` (Postgres rejeita, mas o erro ficava
obscuro).

### C6 — Saldo pré-pago não negativo ([src/hooks/useFinanceiro.ts:511](src/hooks/useFinanceiro.ts))
Antes: `useCreateProcesso` permitia `novoSaldo` ir negativo
silenciosamente.

Agora: lança erro com mensagem clara em PT-BR antes de chamar o
update no banco. Cliente precisa recarregar antes de criar.

> RPC já estava tratando isso atomicamente; isso aqui é a defesa
> client-side para evitar UX confusa.

### C19+C20 — AlertDialog em Catalogo ([src/pages/Catalogo.tsx](src/pages/Catalogo.tsx))
Substituídos os 2 `window.confirm()` por `AlertDialog`
(shadcn/Radix).

Vantagens:
- Acessível por teclado.
- Não bloqueia main thread.
- Visual consistente com o resto do ERP.
- Botão "Excluir" em vermelho destrutivo.

### C16 — TTL em getEmpresaId ([src/lib/storage-path.ts](src/lib/storage-path.ts))
Antes: cache vitalício, só limpava em sign-out manual.

Agora:
- TTL de 5 minutos.
- Cache amarrado ao `user.id` atual; se o user mudar, recarrega.
- `clearEmpresaIdCache` agora também limpa `cachedUserId` e `cachedAt`.

Mitigação para sessões muito longas e troca de conta sem reload.

### C23 — ESLint no-unused-vars ([eslint.config.js](eslint.config.js))
Era `"off"`. Agora `"warn"` (não quebra build) com tolerância para
nomes começando com `_`. Apenas evidencia débito técnico para limpeza
incremental.

---

## Itens críticos que NÃO toquei (precisam de acesso/teste manual)

| # | Item | Por quê |
|---|------|---------|
| C5 | Prompt injection na Dani | Já deferido pelo Thales (28/04) |
| C12 | Outro prompt injection Dani | Idem |
| C11 | Atomicidade do welcome discount | Mexe em RPC Postgres, prefiro Thales acompanhar |
| C22 | TS strict mode | ~250 erros previsíveis, lote dedicado |
| Outros `confirm()` em DetalhesCobrancaModal, ClienteAccordionFinanceiro, MarcarPagoModal, PlanoContasTab | Fluxos financeiros, exigem teste UI manual |
| Service_role / RLS endpoints | Requerem inspeção em Supabase Studio |
| RLS em buckets adicionais | Precisa rodar SQL na produção |

## Próximos passos sugeridos (ordem de risco)

1. **Validar no Lovable** que o build novo subiu sem erros (Lovable
   rebuilda automático ao push).
2. **Conferir CNPJs existentes**: rodar SELECT no banco filtrando
   `clientes.cnpj` que não passariam no novo `isValidCNPJ` —
   provavelmente alguns cadastros antigos têm CNPJ digitado errado;
   listar e me passar para eu ajudar a corrigir.
3. **Substituir confirms restantes** (4 arquivos) em uma sessão com
   você acompanhando UI.
4. **Pass de TS strict** num branch separado.
5. **Atacar C5 + C12** (prompt injection Dani) quando você decidir.

## Estado dos arquivos comprometidos

- ✅ Não foram alteradas Edge Functions Supabase.
- ✅ Não foram alteradas migrations SQL.
- ✅ Não foi tocado `src/integrations/supabase/client.ts` nem
  qualquer arquivo de auth.
- ✅ Lockfile `package-lock.json` permanece intacto (Node 14 chegou
  a corromper localmente, foi descartado com `git checkout`).

## Commits da noite

```
75504d3 chore: ESLint avisa sobre vars/args não usados (C23)
2fd5f28 refactor: AlertDialog em Catalogo + TTL no cache de empresa_id
6eb1a31 fix: validações financeiras e CNPJ (Lote A — bugs de lógica)
6f10352 chore: README, CI workflow, NotFound em PT-BR (Lote C — zero-risco)
```

— Claude
