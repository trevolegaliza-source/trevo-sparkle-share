# 🧪 Testes pendentes — Auditoria 25/05/2026

> Consolidado de todos os smoke tests acumulados nas Sessões A+B+C+D pra rodar quando puder.
> Organizado por PERFIL/FLUXO em vez de por achado — passa rápido.

**Estimativa total:** ~25-30min (depende de quantos perfis tem cadastrados pra testar).

---

## 👑 COMO MASTER (você)

### Fluxo 1: Cobrança Asaas
- [ ] **Editar vencimento** (commits `391ec8d` + `f8b054c`)
  - Cliente com cobrança PENDING → "Detalhes" → "Editar vencimento" → mudar data
  - ✅ Asaas painel: `dueDate` mudou
  - ✅ ERP: vencimento reflete
  - ✅ `SELECT * FROM entidade_audit WHERE campo='data_vencimento' ORDER BY created_at DESC LIMIT 1;` mostra sua entry

- [ ] **Webhook PAYMENT_UPDATED reverso** (edge `asaas-webhook` v30)
  - Editar `dueDate` DIRETO no painel Asaas
  - Aguardar ~5s no ERP
  - ✅ Vencimento sincroniza
  - ✅ Você recebe notif "📅 Vencimento alterado no Asaas"

- [ ] **UX-149 — vencimento sem max** (commit `2303f1f`)
  - Editar vencimento → tentar digitar `2076` → bloqueado (max=hoje+180d)

### Fluxo 2: Preços diferenciados (commit `f8b054c`)
- [ ] **Cliente VITAE** (ou qualquer) → "Preços diferenciados por tipo" → adicionar `abertura R$ 540`
- [ ] Criar processo de abertura para esse cliente
- [ ] ✅ Valor final = R$ 540 (não valor_base)
- [ ] **CODE-011 — upsert atômico** (commit `2329363`)
  - Editar o mesmo preço (clica no valor, muda, salva) → sem erro de duplicata
  - SQL: `SELECT count(*) FROM cliente_precos_por_tipo WHERE cliente_id=X AND tipo='abertura';` = 1

### Fluxo 3: Histórico de alterações (commits `c4a296f` + `154a01d`)
- [ ] **Orçamento** existente → editar valor → salvar → "Histórico" → ver `valor antigo → valor novo`
- [ ] **Processo** existente → editar valor/etapa → ver histórico
- [ ] **CODE-013 — cast safe** — historico abre sem crash mesmo se RPC retornar shape inesperado

### Fluxo 4: Push notifications (commits `819b418` + `2329363`)
- [ ] **Ativar** push no PWA (Configurações)
- [ ] Criar processo qualquer → confirmar push no lockscreen
  - ✅ **SEC-034** — body GENÉRICO ("⚙️ Novo processo cadastrado") em vez de nome+R$
  - ✅ Badge no ícone do app reflete unread
- [ ] **SEC-035 — unread per user** — com 2+ masters cadastrados, cada um vê badge correto (não inflado pela soma)
- [ ] **SEC-036 — unsubscribe ordem** — desativar push → reativar → confirmar `SELECT * FROM push_subscriptions WHERE user_id=X` sem duplicata/órfão
- [ ] **UX-151 — Reativar distinto** — após desativar, voltar pra Configurações → ver "Reativar neste dispositivo" (não "Ativar")

### Fluxo 5: Cache (commit `3b94fee` + `2329363`)
- [ ] **UX-150** — Abrir Financeiro → trocar de aba 30s → voltar → dados não recarregam (cache 10s aceita)
- [ ] Trocar de aba 1min+ → voltar → dados recarregam
- [ ] Dashboard / Processos: trocar de aba → voltar → refresca (default global 30s)

---

## 👥 COMO LETÍCIA OU MICHELE (login em outra janela/anônima)

### Fluxo 6: Operacional + orçamentos (commit `412ff9a`)
- [ ] Letícia/Michele criam novo orçamento (template `operacional` agora inclui `orcamentos`)
- [ ] ✅ Sem "Acesso Restrito"

### Fluxo 7: Histórico mascarado (commit `2303f1f`)
- [ ] **PERM-015** — Orçamento com mudança de valor → "Histórico"
- [ ] ✅ Linha "valor: ••••• → •••••" em vez de R$
- [ ] Confirmar mesmo comportamento em `valor_final`, `valor_avulso`, `desconto_pct`

### Fluxo 8: RLS DELETE refactor (commit `f63b15d`)
- [ ] **DELETE permitido** — Letícia/Michele deletam processo teste → funciona (`pode_excluir=true` em `processos`)
- [ ] **DELETE bloqueado** — tentar deletar lancamento/cobrança → bloquear (`pode_excluir=false` em `financeiro`)
- [ ] Se houver perfil `visualizador`, tentar deletar qualquer coisa → bloqueado

### Fluxo 9: FIN-009 — EditarVencimento sem gate (commit `2303f1f`)
- [ ] Letícia/Michele abrem cobrança → NÃO devem ver botão "Editar vencimento" (`pode_editar('financeiro')=false`)
- [ ] Master vê e edita normalmente

---

## 🔒 SECURITY (browser anônimo, sem login)

### Fluxo 10: SEC-033 — Senha de proposta vira proteção real (commit `2303f1f`)
- [ ] Abrir proposta COM senha cadastrada via DevTools/curl direto à RPC `get_proposta_por_token`:
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/rpc/get_proposta_por_token" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"p_token":"<token-com-senha>"}'
  ```
  ✅ Resposta vazia (`[]`) — antes vinha tudo
- [ ] Mesma chamada com `p_senha` certa → dados aparecem
- [ ] Frontend: abrir URL da proposta → ver só tela de senha (sem dados em memória, conferir via DevTools)

### Fluxo 11: SEC-037 — RPC órfã removida (commit `8ccd91d`)
- [ ] Tentar chamar a RPC dropada:
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/rpc/criar_notificacao_proposta" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"p_orcamento_id":"qualquer-uuid","p_tipo":"aprovacao","p_mensagem":"teste"}'
  ```
  ✅ HTTP 404 "function does not exist"

### Fluxo 12: SEC-038 — _notif_master_func_criou sem EXECUTE PUBLIC (Sessão E)
- [ ] Tentar chamar como anon:
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/rpc/_notif_master_func_criou" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"p_empresa_id":"...","p_ator_id":"...","p_tipo_evento":"x","p_titulo":"y","p_mensagem":"z"}'
  ```
  ✅ HTTP 401/403 (sem grant)
- [ ] Criar processo como funcionário normal (pelo ERP) → master ainda recebe notif "X criou processo Y" (trigger interna não foi afetada)

### Fluxo 13: SEC-039 — criar_evento_proposta exige share_token (Sessão E)
- [ ] Tentar chamar com p_orcamento_id (assinatura antiga):
  ```bash
  curl -X POST "$SUPABASE_URL/rest/v1/rpc/criar_evento_proposta" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d '{"p_orcamento_id":"<uuid>","p_tipo":"x","p_dados":{}}'
  ```
  ✅ Erro de parameter mismatch
- [ ] Recusar proposta pública (fluxo legítimo) → log gravado em `proposta_eventos` (`SELECT * FROM proposta_eventos ORDER BY created_at DESC LIMIT 5`)
- [ ] Tentar tipo inválido:
  ```bash
  curl ... -d '{"p_token":"<token>","p_tipo":"hack","p_dados":{}}'
  ```
  ✅ Erro "tipo inválido"

### Fluxo 14: Notif automática de recusa (trigger nova Sessão E)
- [ ] Cliente recusa proposta via link público → master recebe notif "🔴 Proposta recusada — Fulano (motivo: ...)"
- [ ] Confirmar no sino do ERP

---

## 📋 Se algum falhar

Abrir ticket aqui com:
- Qual fluxo
- O que você fez (passos)
- O que esperava
- O que aconteceu (screenshot ou erro do console)

Eu ataco direto.

---

**Status:** ⏳ Não rodado. Última atualização: 25/05/2026.
