# 13 — Cobrança Pública (`/cobranca/:token`)

> Arquivo: `src/pages/CobrancaPublica.tsx` (1142 linhas)

## 🎯 O que é

Página **pública** (sem auth) que o **cliente final** vê quando recebe link de cobrança via WhatsApp. Mostra dados da cobrança, opções de pagamento (PIX/boleto/cartão Asaas), histórico, contato com a Dani.

**Rota:** `/cobranca/:token` — fora do `ProtectedRoute`. Token é `cobrancas.share_token`.

## 🗺️ Mapa

```
┌──────────────────────────────────────────────────────────┐
│ [🍀 Logo Trevo]                              [Status badge]│
│                                                            │
│ Olá, FATO ASSESSORIA. Sua cobrança.                       │
│ ✓ Pagamento confirmado / ⏰ Aguardando / 🔴 Vencida        │
│                                                            │
│ Valor pago / a pagar: R$ 1.740,00                          │
│                                                            │
│ Detalhes da cobrança:                                      │
│   CHRISTHAIS GESTÃO        R$ 580,00                       │
│   MJ ASSESSORIA EDUC.      R$ 580,00                       │
│   RCB AGROPECUARIA         R$ 580,00                       │
│   ─────────────────────────────                            │
│   Total                    R$ 1.740,00                     │
│                                                            │
│ Precisa de ajuda? [💬 Falar com a Dani no WhatsApp]       │
│                                                            │
│ Histórico:                                                 │
│   Cobrança emitida 11/05/2026 · Vence 14/05/2026          │
│                                                            │
│ Cobrança #f54a9c · Emitida em 11/05/2026 15:02            │
└──────────────────────────────────────────────────────────┘
```

Quando pendente, mostra abas com opções de pagamento (PIX qrcode, boleto, etc).

## 🔬 Interações

### 1. Carregamento
- Busca `cobrancas` por `share_token`
- Busca lancamentos associados
- Verifica status Asaas via `asaas_status`

### 2. Tabs de pagamento (se pendente)
- **PIX** (qrcode + payload copiável)
- **Boleto** (PDF baixável + código de barras)
- **Cartão** (link Asaas)

**Achado UX-027 🟢 (já mapeado):** se boleto ainda não foi gerado (`temBoleto=false`), tab "Boleto" some sem aviso. User confuso.

### 3. Card Dani (WhatsApp)
Link deep link `wa.me/...` com mensagem pre-formatada usando `tipoPrincipal` e `empresaPrincipal`.

**Achado UX-017 🟡 (mapeado):** `tipoPrincipal` é `lancamentos[0].tipo` — em cobrança com 5 lancamentos diferentes (caso FATO), mensagem da Dani só cita 1. Múltiplos processos não refletidos.

### 4. Confetti se pago
`localStorage` dedup 24h.

**Achado UX-024 🟡 (mapeado):** refresh em D+2 dispara confetti de novo. Sugestão: marcador no banco.

### 5. PDF download
Botão "Baixar PDF" do extrato. Gera via `cobranca-pdf` edge function.

### 6. Realtime updates
Subscreve mudanças em `cobrancas.id` — se status muda no banco (webhook Asaas), atualiza UI sem refresh.

## 🐛 Achados

| ID | Severidade | Resumo |
|---|---|---|
| **UX-017** | 🟡 | tipoPrincipal usa [0] em cobrança multi-processo |
| **UX-024** | 🟡 | Confetti dedup 24h |
| **UX-027** | 🟢 | Tab Boleto some sem aviso |

## 🎨 Poluição visual

✅ Layout limpo. Cliente final vê página clara.
🟡 Em cobrança paga, vê texto "Cobrança paga" no badge + "Pagamento confirmado" + valor — algumas redundâncias.

## 🚦 Verdict release amanhã

**🟢 GO.** Cliente final vê. Letícia/secretária não tocam. Já validado em produção (você usou hoje com FATO).
