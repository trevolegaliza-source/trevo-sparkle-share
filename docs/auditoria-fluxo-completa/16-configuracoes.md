# 16 — Configurações (com Gestão de Usuários)

> Arquivos: `src/pages/Configuracoes.tsx` (181 linhas), `src/components/configuracoes/GestaoUsuarios.tsx` (825 linhas)

## 🎯 O que é

Rota `/configuracoes`. Hub de admin. **Só master vê** (`RequirePermission modulo="configuracoes"`).

5 abas:
1. **Aparência** — tema, etc
2. **Usuários** (RBAC) — só master vê (visibilidade condicional via `isMaster()`)
3. **Segurança** — MFA, senha master
4. **Webhooks**
5. **Plano de Contas**

## 🗺️ Mapa de elementos

### Gestão de Usuários (Tab `rbac`)

```
┌─────────────────────────────────────────────────────────────┐
│ Usuários (3 ativos, 2 inativos)         [+ Convidar Usuário]│
│                                                              │
│ [ Avatar Nome <email>  Role Badge  Último acesso  [Ações] ] │
│ [ Avatar Nome <email>  Role Badge  Último acesso  [Ações] ] │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

Ações disponíveis (na linha do usuário):
- Se status = 'aguardando': [Aprovar] [Rejeitar]
- Sempre: [Editar (permissões)] [⋯ Mais (desativar/reativar/remover)]
```

### Modal: Convidar Usuário
- Email
- Role (select com 5 opções)
- "Enviar Convite" → chama edge function `convidar-usuario`

### Modal: Editar Usuário
- Nome
- Role (select)
- **Override granular de permissões** — checkbox por módulo × ação (ver/criar/editar/excluir/aprovar)

## 🔬 Interações detalhadas

### 1. Botão "Convidar Usuário" (linha 484)
- Abre modal de convite
- Form: email + role
- Submit (`handleInvite` linha 393):
  - Pega access token da sessão
  - POST `${SUPABASE_URL}/functions/v1/convidar-usuario` com `{email, role}`
  - Edge function cria auth.user e profile

**Achado UX-051 🟡:** ao enviar convite, edge function cria user mas NÃO envia email com link de set-password automático. User convidado precisa fazer "Esqueci senha" pra entrar. Pode confundir Letícia/secretária.

### 2. Aprovar / Rejeitar (linhas 552-557)
- Botões só aparecem se user em estado "aguardando" (ativo=null ou false após signup)
- `handleApprove` (linha 335): UPDATE `profiles.ativo = true`
- `handleReject` (linha 353): UPDATE `profiles.ativo = false, motivo_inativacao = 'Acesso rejeitado'`

**Achado SEC-012 🔴:** ambos sem confirmação. Master clica errado, aprova quem não devia. Especialmente "Aprovar" — abre acesso instantâneo.

**Achado UX-048 🟡:** `handleApprove` não notifica o user aprovado. Letícia/secretária não vão saber que podem entrar — vão tentar e descobrir. Sugestão: insert em `notificacoes` ou email via edge.

**Achado SEC-010 🟡:** `handleApprove` não valida `role`. Se profile veio com `role=null` (caso edge), `ativo=true` mas perdeVer/podeCriar não funcionam — estado quebrado.

### 3. Editar Usuário — Permissões granulares
- Abre modal com lista de módulos × ações
- Salvar (linha 759 `handleSave`):
  - DELETE todas `user_permissions` do user
  - INSERT novas linhas com checkboxes marcados
- Atualiza `profile.role` também se mudou no select

**Achado SEC-013 🟡:** DELETE-then-INSERT em transação separada (não atomic). Se INSERT falha, user fica sem nenhuma permissão. Race condition. Fix: RPC `salvar_permissoes_usuario` que faz tudo em transação.

**Achado UX-052 🟡:** UI de permissões granulares é checkbox-pesada (10+ módulos × 5 ações = 50+ checkboxes). Sem busca/filtro de módulo. Confuso pra master que quer só "dar acesso pontual".

### 4. Desativar (linha 571 → handleDeactivate linha 294)
- Abre modal com input "motivo da inativação"
- Submit: UPDATE `profiles.ativo = false, motivo_inativacao = motivo`

**Achado UX-053 🟢:** motivo é opcional mas o input parece obrigatório. Visual confuso.

### 5. Reativar (linha 576 → handleReactivate)
- UPDATE `profiles.ativo = true, motivo_inativacao = null`
- Sem confirmação ✅ ok (não-destrutivo)

### 6. Remover (linha 580 → handleDelete linha 372)
- AlertDialog "Remover usuário?"
- **NÃO DELETA REALMENTE** — só seta `ativo=false, motivo_inativacao='Removido pelo administrador'`
- Auth.user fica intacto (user pode tentar login, vai falhar por `ativo=false`)

**Achado SEC-014 🔴:** label "Remover" engana. Cara acha que apagou e o user some pra sempre — mas só desativou. Profile fica visível na lista (filtrado mas presente). Auth.user também. **Fix:** ou renomear pra "Desativar permanente" OU chamar edge function `revogar-usuario` que faz DELETE no auth + profile (audit log).

**Achado SEC-011 🔴:** sem PasswordConfirmDialog. Em outros lugares (arquivar cliente) exige password. Aqui não — desativa user com 1 clique no confirm.

### 7. Self-protection
- ⚠️ Não testei: master consegue desativar a si mesmo? Olhando código não vejo guard. Se sim, **buga** (precisa outro master pra reverter).

**Achado SEC-015 🔴:** sem guard `profile.id !== currentUser.id` em Desativar/Remover. Master pode se desativar. Fix: disabled no botão quando `p.id === user.id`.

## 🐛 Bugs / Inconsistências

| ID | Severidade | Problema | Fix |
|---|---|---|---|
| **SEC-009** | 🟡 | "Remover" não deleta de fato (só desativa) | Renomear OU implementar delete real |
| **SEC-010** | 🟡 | `handleApprove` não valida role | Check `role !== null` antes de UPDATE |
| **SEC-011** | 🔴 | Sem PasswordConfirmDialog em ações destrutivas | Wrap Desativar/Remover/Rejeitar |
| **SEC-012** | 🔴 | Aprovar/Rejeitar sem confirm | AlertDialog antes |
| **SEC-013** | 🟡 | Save permissions sem atomicidade (DELETE+INSERT) | RPC `salvar_permissoes_usuario` |
| **SEC-014** | 🔴 | Label "Remover" engana — só desativa | Renomear OU implementar delete real |
| **SEC-015** | 🔴 | Master pode se auto-desativar | `disabled={p.id === user.id}` |
| **UX-048** | 🟡 | `handleApprove` não avisa user aprovado | Insert em `notificacoes` + email |
| **UX-051** | 🟡 | Convidar não envia link set-password | Edge function envia magic link |
| **UX-052** | 🟡 | UI permissões granulares pesada (50+ checkboxes) | Grupos colapsáveis + busca |
| **UX-053** | 🟢 | Motivo desativação parece obrigatório | Placeholder "(opcional)" |

## 🎨 Poluição visual

🟡 Tab "Usuários" tem MUITA densidade — lista vertical longa + cada user com 3-4 botões inline. Em mobile vira scroll horizontal feio.
🟡 Modal "Editar Usuário" empilha select de role + permissões granulares. Master que só quer mudar role acaba scrollando demais.

## 🚦 Verdict release amanhã

**🔴 NO-GO sem fixes mínimos.** Esta é a tela MAIS CRÍTICA pra abertura amanhã. Master = Thales é o único que mexe aqui.

### Bloqueadores reais (não pode liberar sem):

- **SEC-015** (auto-desativar) — você pode literalmente se trancar fora do sistema com 1 clique. **30min de fix.** `disabled={p.id === user.id}` no botão Desativar e Remover.

- **SEC-014** (Remover engana) — se você clicar "Remover" em Letícia pra "limpar a base" achando que tá deletando teste, vai só desativar. Letícia continua na lista, e o auth.user permanece. Em produção pode causar confusão e ações em série. Mínimo: renomear pra "Desativar permanente" + tooltip explicativo.

### Recomendações antes do release (não bloqueia):

- **SEC-012** (aprovar/rejeitar sem confirm) — clicar errado libera ou bloqueia. AlertDialog de 30min.
- **UX-048** (não notifica aprovado) — Letícia/secretária ficam no escuro. WhatsApp via Dani como workaround manual.

### Plano sugerido:

Tu mesmo amanhã antes de liberar:
1. (5min) Cria as contas via "Convidar Usuário" com role correto (gerente/operacional)
2. (5min) Aprova você mesmo no painel (a edge function provavelmente já cria como aprovado)
3. (5min) Edita permissões granulares só se quiser tirar/dar algo do template default
4. Aviso a Letícia + secretária por WhatsApp que estão liberadas
5. Pede pra elas fazerem login com a senha que tu definir (ou faz `signInWithMagicLink` se a edge suportar)

Após o release, ataca SEC-015 e SEC-014 numa sessão de cleanup.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **SEC-009** | "Remover" não deleta de fato |
| **SEC-010** | `handleApprove` sem validar role |
| **SEC-011** | Ações destrutivas sem PasswordConfirm |
| **SEC-012** | Aprovar/Rejeitar sem confirm |
| **SEC-013** | Save permissions sem atomicidade |
| **SEC-014** | Label "Remover" engana |
| **SEC-015** | Master pode se auto-desativar |
| **UX-048** | Não notifica aprovado |
| **UX-051** | Convite não envia link set-password |
| **UX-052** | UI permissões pesada |
| **UX-053** | Motivo desativação parece obrigatório |
