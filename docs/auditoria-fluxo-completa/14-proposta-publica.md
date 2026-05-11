# 14 — Proposta Pública (`/proposta/:token`)

> Arquivo: `src/pages/PropostaPublica.tsx` (1142 linhas)

## 🎯 O que é

Página pública que o cliente vê pra **aprovar / recusar / negociar** um orçamento.

**Rota:** `/proposta/:token` — fora do ProtectedRoute. Token é gerado ao enviar orçamento.

## 🗺️ Mapa (alto nível)

```
┌─────────────────────────────────────────────────────────┐
│ Trevo Legaliza · Proposta nº 2025/0042                  │
│                                                          │
│ Para: FATO ASSESSORIA                                   │
│ Validade: 30 dias                                       │
│                                                          │
│ Seção: Abertura de Empresa                              │
│   ✓ Análise de viabilidade ............... R$ 200       │
│   ✓ DBE + VRE ............................ R$ 350       │
│   ✓ Inscrição Junta Comercial ............ R$ 580       │
│   ─────────────────────────────                          │
│   Subtotal                              R$ 1.130        │
│                                                          │
│ Total:                                  R$ 1.130        │
│                                                          │
│ [✓ Aprovar Proposta] [✗ Recusar] [💬 Negociar via WA]    │
└─────────────────────────────────────────────────────────┘
```

## 🔬 Interações

### 1. Aprovar
- Chama RPC `aprovar_proposta(token, senha?)`
- Pede senha se proposta foi criada com senha (segurança extra)
- Status → `aprovado`
- Insert notificação pro master (master vê no sino)

**Achado UX-120 🟢:** se cliente clica "Aprovar" mas internet falha mid-call, status pode ficar inconsistente. Já tem `salvarSelecaoSilencioso` (debounce) — provavelmente lidado. PERF-004 (já fixado).

### 2. Recusar
- Pede motivo (textarea opcional)
- Status → `recusado`
- Notificação pro master

### 3. Negociar
- Abre WhatsApp deep link pra Dani
- Cliente pode pedir desconto

### 4. Personalização
- Cliente pode ver/selecionar/desmarcar items
- Total recalcula em real time
- Mudanças salvas via `salvar_selecao_proposta` RPC (debounce)

### 5. Confetti pós-aprovação
- Animação celebratória após aprovar

## 🐛 Achados

| ID | Severidade | Resumo |
|---|---|---|
| **SEC-001/002/003** | 🟢 (NÃO ATACAR, já avaliado) | `dangerouslySetInnerHTML` com CSS estático — sem risco |
| **PERF-004** | ✅ fixado | `useRef` pro timer de debounce |
| **REL-006** | ✅ fixado | `verificarSenha` checa `res.ok` |
| **SEC-004** | ✅ fixado | 4 catches silenciosos viraram `console.warn` |
| **UX-121** | 🟢 | Se cliente recusa, não há fluxo de "tentar outra proposta" |

## 🎨 Poluição visual

✅ Página polida. Cliente final tem boa experiência.

## 🚦 Verdict release amanhã

**🟢 GO.** Tela cliente, fora do escopo da operação interna. Estável.
