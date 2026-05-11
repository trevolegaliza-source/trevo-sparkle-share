# 02 — Login / Auth

> Arquivos: `src/pages/Login.tsx` (518 linhas), `src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`

## 🎯 O que é

Tela de entrada do sistema. 3 modos no mesmo arquivo:
1. **Login** (email + senha + Google OAuth)
2. **Solicitar Acesso** (registro, exige `@trevolegaliza.com.br`)
3. **Esqueci minha senha** (reset por email)

Rota: NÃO TEM rota explícita pra `/login`. `ProtectedRoute` redireciona pra ela quando não autenticado.

## 🗺️ Mapa de elementos

```
┌──────────────────────────────────────────┐
│          🍀 Logo Trevo                   │
│                                          │
│  Sistema de Gestão Societária            │
│                                          │
│  E-mail [_____________________]          │
│  Senha  [_____________________] 👁️        │
│                                          │
│  [        Entrar         ]               │
│  Esqueci minha senha                     │
│                                          │
│ ─────────────── ou ───────────────       │
│                                          │
│  [   🔵 Entrar com Google   ]            │
│                                          │
│ ──────────── novo por aqui? ──────────── │
│                                          │
│  [  ➕ Solicitar Acesso  ]               │
│                                          │
│           Trevo Engine v10 · © 2026      │
└──────────────────────────────────────────┘
```

## 🔬 Interações

### Modo 1: Login

**Submit:**
- Valida campos não-vazios (toast se faltar)
- Chama `supabase.auth.signInWithPassword({email, password})`
- Erros traduzidos pra PT-BR via `friendlyAuthError()` ✅ — boa decoração
- Sucesso: `AuthContext` detecta, `ProtectedRoute` libera

**Botão "Esqueci minha senha":**
- Troca pra modo `forgot`
- Pré-preenche `forgotEmail` com o que já estava em `email`

**Botão "Entrar com Google":**
- Chama `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- ⚠️ **Achado UX-042 🟡:** Google sign-in não restringe domínio. Se Letícia entrar com `leticia@gmail.com`, **cria `auth.user` mas NÃO cria `profile`** (trigger só dispara em sign-up via email). User vira "fantasma" (PERM-004). Fix: bloquear Google sign-in se email não termina em `@trevolegaliza.com.br` (verificar no callback ou usar OAuth `hd` parameter).

**Botão "Solicitar Acesso":**
- Troca pra modo `register`

### Modo 2: Solicitar Acesso (registro)

**Form fields:**
- Nome completo (texto)
- CPF (auto-formata `000.000.000-00`)
- Data de nascimento (date input)
- Email corporativo (validado terminar em `@trevolegaliza.com.br`)
- Senha (min 8 chars, com toggle de visibilidade)
- Confirmar senha (sem toggle)

**Submit (`handleRegister`):**
1. Validações client-side (linha 97-106)
2. `supabase.auth.signUp({ email, password, options: { data } })` — cria `auth.user`
3. **Espera 1000ms** pra trigger criar profile (`linha 128`)
4. UPDATE profile com cpf, data_nascimento, nome
5. Insert notificação pro master (best-effort, catch silencioso)
6. `setRegSuccess(true)` + `signOut()` imediato (linha 159) — user não acessa nada até admin aprovar
7. Tela de sucesso aparece

**Achado REL-017 🔴:** linha 126-133 — race condition. Se o trigger DB demora mais que 1s pra criar profile (latência ruim, ou trigger falha), UPDATE não acha o profile e silencia. Resultado: user cadastrado com `auth.user` mas sem CPF/nascimento no profile. Fix: usar `upsert` ou retry loop.

**Achado UX-043 🟡:** ao registrar com sucesso, signOut imediato + tela "Aguardando aprovação". Mas o user pode tentar login antes da aprovação — vai entrar, mas `usePermissions` vai ver `ativo=false` e zerar tudo, gerando estado "logado mas vazio". Não dá feedback claro. Sugestão: redirecionar pra tela "Conta aguardando aprovação".

**Achado UX-046 🟡:** linha 144-150 — insert de notificação pro master é best-effort. Se RLS falha (que NÃO deveria, mas falhou em testes anteriores), master não recebe alerta de novo cadastro. Sem fallback (email pro admin).

**Achado REL-018 🟡:** linha 141 — `.eq('role', 'master').limit(1).single()` pega só 1 master. Multi-master tu já tem 1 só, então OK por enquanto.

### Modo 3: Esqueci minha senha

**Submit:**
- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`
- Mostra "Email enviado!" mesmo se email não existir (boa prática — anti-enumeration). ✅

**Achado REL-019 🟡:** `redirectTo: '/reset-password'` aponta pra rota que **não está mapeada em `App.tsx`**. Quando o user clicar no link do email, cai em `<NotFound />`. **Quebrado.** Fix: criar rota `/reset-password` com componente que aceita o token do hash.

## 🐛 Bugs / Inconsistências

| ID | Severidade | Problema | Fix |
|---|---|---|---|
| **REL-017** | 🔴 | Race condition no register (1s arbitrário pra trigger) | Retry/upsert |
| **REL-019** | 🔴 | `/reset-password` não existe — link de reset cai em 404 | Criar rota + handler |
| **UX-042** | 🟡 | Google OAuth aceita qualquer domínio | Validar domínio no callback |
| **UX-043** | 🟡 | Login após register pré-aprovação dá estado vazio | Tela "aguardando aprovação" |
| **UX-046** | 🟡 | Notificação pro master é best-effort sem fallback | Webhook/email backup |
| **REL-018** | 🟢 | Multi-master só notifica 1 | `.eq('role', 'master')` (sem limit/single) + loop |
| **PERM-004** | 🔴 | User logado sem profile vira fantasma | Trigger sólido + check no `usePermissions` |

## 🎨 Poluição visual

✅ Layout limpo, glass-card bonito, animações suaves.
✅ Single source — 3 modos no mesmo arquivo evita rotas múltiplas.
🟡 Modo 'register' é longo — 6 campos. Em mobile, viewport corre pra mostrar a senha. Considere step-by-step OU dividir em 2 cards (dados pessoais → credenciais).

## 🚦 Verdict release amanhã

**🟡 GO com 2 ressalvas:**

### 🔴 BLOQUEADOR — REL-019 (`/reset-password` 404)
Se Letícia ou secretária esquecerem a senha e clicarem no link do email, caem em 404. **Pra release amanhã, ou (a) cria a rota agora, ou (b) instrui Thales a resetar senha manual via Supabase Dashboard quando alguém pedir.** Opção (b) viável pra 2 usuários.

### 🟡 ATENÇÃO — Email corporativo
Antes de criar conta pra Letícia/secretária:
1. Garante que ambas têm `@trevolegaliza.com.br` configurado
2. Caso contrário, alterar `regEmail.toLowerCase().endsWith('@trevolegaliza.com.br')` pra aceitar email pessoal — ou tu mesmo cria as contas (via Supabase Dashboard → Auth → Invite) e pula o fluxo de registro

### Sugestões antes do release
- **NAV-rep ↔ Auth**: PERM-004 (estado fantasma sem profile) — adicionar logout automático em `usePermissions` quando profile ausente.
- **REL-017**: tu provavelmente só vai testar com 2 contas amanhã, e a latência local do trigger é <100ms — não vai estourar. Mas marca pra investigar.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **REL-017** | Race condition register (1s wait pra trigger) |
| **REL-018** | Notif pro master só pega 1 |
| **REL-019** | `/reset-password` rota não existe |
| **UX-042** | Google OAuth não restringe domínio |
| **UX-043** | Login pré-aprovação = estado vazio sem feedback |
| **UX-046** | Notificação master best-effort sem fallback |
