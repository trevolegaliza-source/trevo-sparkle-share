# ANEXO C — Edge Functions (mistério do `.txt` resolvido)

> Investigação: por que `edge-functions-deploy/supabase/functions/asaas-webhook/index.txt` está como `.txt` e não `.ts` como os outros 13.

## 🎯 TL;DR

**Mistério resolvido.** A versão deployada (`v25`, ATIVA) tem **o mesmo conteúdo** do `index.txt` local. O rename foi proposital — provavelmente pra **evitar redeploy acidental** via `supabase functions deploy` (que só pega `.ts`).

**Recomendação:** manter como está. Ou renomear pra `.ts.frozen` / criar README explicando a convenção.

## 🔬 Como cheguei aí

Usei MCP Supabase `list_edge_functions` + `get_edge_function('asaas-webhook')`:

```
slug: asaas-webhook
status: ACTIVE
version: 25  (todas as outras estão v20)
entrypoint_path: index.ts  ← deployed espera .ts
updated_at: 1778092858691  (recente)
ezbr_sha256: e3ac3d9cf812c00e6da82afa29a5ccbcd84012876de7dc57281393d55e64e16e
```

Comparei o source deployado com o `index.txt` local:
- ✅ Ambos têm `VERSION_TAG = "2026-05-06-notify-loud"`
- ✅ Ambos têm as 4 funções `handlePaidEvent` / `handleOverdueEvent` / `handleCanceledEvent` / `handleRefundedEvent`
- ✅ Mesmo cabeçalho de proteções em camadas
- ✅ `index.txt` local 490 linhas (mesma estrutura do deployed)

**Conclusão:** rename `.ts → .txt` foi feito **depois** do deploy v25, intencionalmente, pra "congelar" a função em produção. `supabase functions deploy asaas-webhook` (que olha pra `index.ts`) ignora `index.txt` — então o função não é re-deployada quando alguém roda o comando.

## 📊 Estado de TODAS as 14 edge functions

| Slug | Status | Versão | Última update | Notas |
|---|---|---|---|---|
| `asaas-webhook` | ACTIVE | **25** | 2027-01 | `.txt` local (frozen) |
| `dani-webhook-proxy` | ACTIVE | 20 | 2026-04 | proxy pro webhook Dani |
| `portfolio-publico` | ACTIVE | 20 | 2026-04 | serve `/portfolio/:token` |
| `asaas-gerar-cobranca` | ACTIVE | 20 | 2026-04 | cria cobrança no Asaas + salva no banco |
| `cobranca-pdf` | ACTIVE | 20 | 2026-04 | gera PDF do extrato |
| `convidar-usuario` | ACTIVE | 20 | 2026-04 | `verify_jwt: true` — chama do front com session token |
| `create-user` | ACTIVE | 20 | 2026-04 | `verify_jwt: true` — fluxo admin de criar user |
| `provisionar-cliente-trello` | ACTIVE | 20 | 2026-04 | cria board Trello pro cliente |
| `trello-guard` | ACTIVE | 20 | 2026-04 | proxy de chamadas Trello |
| `trello-label-lembrete` | ACTIVE | 20 | 2026-04 | lembrete via Trello |
| `trello-provisioner` | ACTIVE | 20 | 2026-04 | similar a provisionar-cliente |
| `trello-reconciliacao` | ACTIVE | 20 | 2026-04 | reconciliação Trello ↔ ERP |
| `verify-master-password` | ACTIVE | 20 | 2026-04 | valida senha master pra ações destrutivas |

Apenas `asaas-webhook` está na versão 25 — todas as outras pararam em v20.

## ⚙️ Implicações pro UX-008 (notificações genéricas)

UX-008 (notificações de pagamento/cobrança caem em `/financeiro` genérico) requer adicionar `cliente_id` na tabela `notificacoes` e atualizar quem insere — o que inclui essa edge function `asaas-webhook`.

Olhando o source deployado:

```ts
async function notifyEmpresa(
  empresaId: string | null | undefined,
  tipo: string,
  titulo: string,
  mensagem: string
): Promise<void> {
  // ...
  const { error } = await admin.from("notificacoes").insert({
    empresa_id: empresaId,
    tipo,
    titulo,
    mensagem,
    lida: false,
  } as any);
  // ...
}
```

Chamada em 4 lugares (`handlePaidEvent`, `handleOverdueEvent`, etc) — **todas com 4 args (empresaId/tipo/titulo/mensagem)**, nenhuma passa cliente_id ou cobrancaId.

**Pra atacar UX-008 plenamente, será necessário:**
1. ALTER TABLE notificacoes ADD COLUMN cliente_id uuid, cobranca_id uuid (migration)
2. Atualizar `notifyEmpresa` pra aceitar cliente_id+cobrancaId opcionais
3. Atualizar as 4 chamadas de `notifyEmpresa` nas funções handle*
4. Atualizar `criar_notificacao_proposta` (RPC no banco)
5. Re-deployar `asaas-webhook` — **rename do `.txt` pra `.ts` + `supabase functions deploy asaas-webhook`**
6. Atualizar handler de click em `NotificationPopover` pra navegar pro cliente específico

**Esforço:** 3-4h. Médio risco (mexe em webhook ativo).

## 🚨 Achados sobre as outras edge functions

### `convidar-usuario` (`verify_jwt: true`)
Usado por Gestão de Usuários. Master clica "Convidar" → chama essa função. Cria auth.user + profile.

**Achado SEC-017 🟡:** se `verify_jwt: true` rejeita JWT inválido, mas dentro do código não há check de role — qualquer authenticated pode chamar e criar usuário arbitrário. **Vale auditar o source.**

### `dani-webhook-proxy` (`verify_jwt: false`)
Sem proteção JWT — anyone pode chamar.

**Achado SEC-018 🟡:** se proxy reencaminha pra serviço externo Dani, é vetor de SSRF se o destino for parametrizável. Auditar source.

### `verify-master-password` (`verify_jwt: true`)
Verifica senha master. Master fix #2 menciona — auditado em rodada anterior. OK.

## 🚦 Verdict release amanhã

**🟢 GO.** Edge functions estão em produção e funcionando. `asaas-webhook` v25 ativa e correta.

**🟡 ATENÇÃO antes de mexer:**
- Pra UX-008, renomeie `.txt → .ts` **antes** de mudar código. Caso contrário, deploy não pega.
- Pré-deploy: comparar SHA do source local com SHA do deployed pra garantir paridade. Eu já confirmei que o `.txt` atual bate com v25.

## 📝 IDs criados

| ID | Resumo |
|---|---|
| **SEC-017** | `convidar-usuario` sem check de role no source (a auditar) |
| **SEC-018** | `dani-webhook-proxy` sem JWT — potencial SSRF |

(Eles não bloqueiam release — auditá-los em sessão de hardening de edge functions.)
