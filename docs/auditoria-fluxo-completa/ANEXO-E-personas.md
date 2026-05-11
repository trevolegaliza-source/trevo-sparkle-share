# ANEXO E — Personas e roles

> **Pergunta central:** quando o Thales criar a conta da Letícia e da secretária amanhã, qual role escolher pra cada uma?

## 📋 Os 5 roles disponíveis (do banco `role_templates`)

### 1. `master` — Thales (você)
- Acesso TOTAL a todos os módulos
- Único role que pode `configuracoes` (gestão de usuários, integrações, empresa)
- Bypass em todas as checagens de `pode_*`
- **Não deve ser dado a mais ninguém**

### 2. `gerente` — opera com autonomia
**Vê:** `dashboard`, `cadastro_rapido`, `processos`, `clientes`, `orcamentos`, `financeiro`, `contas_pagar`, `relatorios_dre`, `fluxo_caixa`, `documentos`, `intel_geografica`, `catalogo`

**Não vê:** `colaboradores`, `configuracoes`

**`podeVerValores`** ✅ — vê dinheiro

> Descrição oficial: "Opera o sistema com autonomia. Não configura usuários."

### 3. `financeiro` — foco em cobrança
**Vê:** `processos`, `clientes`, `financeiro`, `contas_pagar`, `relatorios_dre`, `fluxo_caixa`, `colaboradores`, `orcamentos`

**Não vê:** `dashboard`, `cadastro_rapido`, `documentos`, `intel_geografica`, `catalogo`, `configuracoes`

**`podeVerValores`** ✅

> Descrição oficial: "Cobranças, extratos, contas a pagar e relatórios."

**⚠️ Inconsistência observada:** o template `financeiro` inclui `colaboradores` (folha de pagamento) e exclui `dashboard`. Esquisito porque dashboard mostra KPIs financeiros principais — alguém em financeiro deveria ver. Já `colaboradores` é dado sensível de RH, geralmente desacoplado do financeiro. (Reportado em ANEXO-A.)

### 4. `operacional` — secretária/operador
**Vê:** `cadastro_rapido`, `processos`, `clientes`, `documentos`, `intel_geografica`, `catalogo`

**Não vê:** `financeiro`, `contas_pagar`, `orcamentos`, `colaboradores`, `dashboard`, `configuracoes`, relatórios

**`podeVerValores`** ❌ — não vê dinheiro (valores aparecem mascarados)

> Descrição oficial: "Processos, clientes, cadastro rápido e documentos."

### 5. `visualizador` — read-only
**Vê:** `processos`, `clientes` (só)

**Não pode:** criar, editar, excluir nada (hard-coded em `usePermissions`)

> Descrição oficial: "Somente leitura nos módulos autorizados."

---

## 🎯 Sugestão pro release amanhã

### Letícia (gestora)
- **Role recomendada:** `gerente`
- **Razão:** opera o sistema completo (cadastra, cobra, fatura), mas não toca configuração nem gestão de usuários. Vê dinheiro (precisa pro trabalho).
- **Cuidados:**
  - Letícia NÃO vê `colaboradores` por padrão (folha de pagamento) — se ela precisar, criar `user_permissions` granular pra ela
  - Se você quiser dar acesso a configuração (ex: criar etiquetas, ajustar preços), considere criar `gerente_avancado` no banco em vez de promover ela a master

### Secretária
- **Role recomendada:** `operacional`
- **Razão:** cadastra clientes/processos, busca informações, anexa documentos. Não vê dinheiro nem fluxo de cobrança.
- **Cuidados:**
  - Ela NÃO vê valores financeiros (proteção contra "olhar margem" / "ver quanto cliente pagou")
  - Ela NÃO vê dashboard — boa decisão pra ela focar na operação
  - Mas tem ressalva abaixo

---

## 🚨 Achados sobre o sistema de permissões

### PERM-001 🟡 `role='financeiro'` template tem `colaboradores`
Template default do `financeiro` inclui `colaboradores` (folha de pagamento). Operador financeiro genérico provavelmente não deveria ver salários de todos. Decisão de produto.

**Fix sugerido:** remover `colaboradores` do template `financeiro`. Master/gerente individual continua podendo dar acesso granular via `user_permissions` quando necessário.

### PERM-002 🟡 `role='operacional'` NÃO tem `dashboard`
Secretária não vê dashboard nem mesmo o que está pendente. Pode achar o sistema "vazio" no login.

**Fix sugerido:** adicionar `dashboard` no template `operacional`. Dashboard já filtra por permissão internamente (`podeVerValores`), então valores ficam ocultos pra eles automaticamente.

Alternativa: criar uma rota `/inicio` mais minimalista pra `operacional` (ex: atalhos pra cadastro rápido, lista de processos abertos).

### PERM-003 🔴 `role='visualizador'` template inclui `processos`+`clientes` MAS hook `podeVer` cai em `templateModulos.includes(modulo)`
Olhando o código:
```ts
const podeVer = (modulo: string) => {
  if (isMaster()) return true;
  if (Object.keys(perms).length > 0) {
    return perms[modulo]?.pode_ver ?? false;
  }
  return templateModulos.includes(modulo); // ← visualizador cai aqui
};
```
`visualizador` sem `user_permissions` específicas cai no template — que dá `processos` + `clientes`. **Funciona como esperado.** OK.

Mas: `podeCriar`/`podeEditar`/`podeExcluir` retornam `false` cedo se `role==='visualizador'`. ✅ proteção ativa.

### PERM-004 🔴 `usePermissions` falha silenciosa sem profile
Linhas 45-49:
```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('role, empresa_id, ativo')
  .eq('id', user.id)
  .single() as any;
```
Se a query falha (RLS deny, profile não criado), `profile` vira `undefined` e o hook sai sem setar role. Result: usuário em estado "fantasma" — `role=null`, `podeVer` retorna false pra tudo, mas a página `Dashboard` etc tenta carregar e dá erro genérico.

**Pré-release:** garantir que TODO user em `auth.users` tem profile correspondente em `public.profiles`. Trigger ou check.

### PERM-005 🟡 `/reconciliacao-trello` NÃO TEM RequirePermission
`App.tsx:175`:
```tsx
<Route path="/reconciliacao-trello" element={<ReconciliacaoTrello />} />
```
Qualquer autenticado pode acessar via URL direta. Considerando que essa tela mostra dados de processos+Trello (integração interna), é vetor de leak pra `operacional`/`visualizador`.

**Fix sugerido:** envolver com `<RequirePermission modulo="configuracoes">` (admin-only) ou criar módulo `reconciliacao_trello`.

### PERM-006 🟡 `podeVerValores` exclui `operacional` mas mantém comportamento via componente `<ValorProtegido>`
Function:
```ts
const podeVerValores = () => isMaster() || role === 'financeiro' || role === 'gerente';
```
Usado em pontos sensíveis (Dashboard KPIs, ClienteDetalhe Faturas). Bom design.

**Mas:** depende do componente render-time. Se algum dev esquecer de envolver com `<ValorProtegido>`, o valor vaza. Audit visual necessário em todos os lugares onde valor aparece (tem 30+ ocorrências de `formatBRL`/`fmt` no código).

### PERM-007 🔴 RLS no banco — não auditado nesta sessão
Ver `ANEXO-A-permissoes-rls.md` pra mapa completo de RLS por tabela. Front pode estar correto mas RLS no banco é o cinturão de segurança final. **Crítico pré-release.**

---

## 📊 Quem está cadastrado hoje

5 profiles na tabela `profiles`:

| Role | Status | Quando |
|---|---|---|
| master | ✅ ativo | 31/03 |
| financeiro | ✅ ativo | 12/04 |
| operacional | ✅ ativo | 15/04 |
| operacional | ❌ inativo | 28/04 |
| visualizador | ❌ inativo | 28/04 |

**Observação:** já tem 1 user `financeiro` e 1 `operacional` ativos. Quem são? Pode ser teste antigo. Vale conferir antes de criar Letícia/secretária — se forem antigos sem uso, considere reciclar.

---

## ✅ Resumo de release

| Persona | Role | Verdict |
|---|---|---|
| Thales | `master` | ✅ já configurado |
| Letícia (gestora) | `gerente` | ✅ GO se PERM-002 não te incomoda |
| Secretária | `operacional` | ✅ GO. Considere PERM-002 (dashboard) antes |

**Antes de criar:** revogue os profiles inativos da tabela (ou pelo menos confira se não vão confundir).
