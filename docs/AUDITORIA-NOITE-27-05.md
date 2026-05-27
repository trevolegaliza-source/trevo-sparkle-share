# Auditoria multi-agente — noite 27/05/2026

Sessão autônoma. 4 agentes (programador / comercial / designer / security) rodaram em paralelo. **47 achados totais** consolidados abaixo.

## 🔴 CRÍTICOS (atacar primeiro)

### Security
- **SEC-01** [ALTO]: `get_proposta_status` vaza `prospect_nome` sem checar `senha_link`. Atacante com share_token confirma proposta + nome do cliente sem nunca digitar senha.
  - Fix: se `senha_link <> ''` E status `OK`, esconder PII; só liberar quando `get_proposta_por_token` valida senha.
- **SEC-02** [ALTO]: `disparar_gerar_pdf_proposta` sem rate limit + sem filtro de status. Usuário interno pode disparar 1000 PDFs em loop (custo PDFShift + Google Docs).
  - Fix: checar status `IN ('enviado','aguardando_pagamento','aceito')` + rate limit 30s.

### Programador
- **ITEM-01** [CRÍTICO]: Polling do PDF na landing chama `get_proposta_por_token` sem `p_senha`. Em propostas com senha, polling nunca acha pdf_url.
  - Fix: passar senha cacheada OU criar RPC `get_proposta_pdf_url(token)` pública pós-aceite.
- **ITEM-02** [CRÍTICO]: `handleRecusar` faz `await res.json()` antes de checar `res.ok`. Se 502/504 com body não-JSON, lança e cai em catch genérico.
  - Fix: checar `res.ok` antes de parsear body.
- **ITEM-03** [CRÍTICO]: Race condition no autosave criando duplicata mesmo com `criandoRef`. Effect deps faltam `propostaId`.
- **ITEM-04** [CRÍTICO]: `handleAceitar` não busca pdf_url imediatamente após aceite — sempre cai no polling de 5s mesmo quando pré-gerado já existe.
  - Fix: fetch único do terc_pdf_url logo após `setStatusLocal('aceito')`.
- **ITEM-05** [CRÍTICO]: `get_cobranca_token_by_proposta` retorna jsonb. Validação `typeof tok === 'string'` falha silenciosamente se Supabase retornar objeto.

### Designer
- **DSG-01** [CRÍTICO]: Header do hero estoura em iPhone SE (375px). Logo 112px + texto + CNPJ lado-a-lado não cabem.
  - Fix: flex-col em mobile.
- **DSG-02** [CRÍTICO]: Card valor principal com `text-7xl` + `break-all` quebra "R$ 1.245,00" no meio do número.
  - Fix: trocar `break-all` por `break-words`, reduzir clamp pra `md:text-5xl`.
- **DSG-03** [CRÍTICO]: Botão "Voltar e visualizar proposta" + "Recusar com motivo" têm tap target < 44px. Difícil clicar em mobile.

## 🟡 ALTA importância

### Comercial
- **COM-01**: Stats do hero institucionais (12 anos / 26 estados) — quer outcome do cliente
- **COM-02**: "+3.800 escritórios" aparece SÓ nos depoimentos. Devia estar no hero
- **COM-03**: Calculadora ROI ainda mostra mensagem "ainda assim você ganha em qualidade de vida" quando ganhoReal < 0 — soa como mea-culpa
- **COM-04**: Depoimentos com sobrenome abreviado parecem fabricados
- **COM-05**: Modal de confirmação não comunica reversibilidade — cético acha "vou assinar R$ 50k num botão verde"
- **COM-06**: Falta tratativa do medo #1: "vou perder relação com meu cliente / Trevo vai roubar"
- **COM-08**: Bloco dani.ai aparece 3x (card grande + inclusos + step 04)
- **COM-09**: Hierarquia errada — financeiro depois de ROI (causa-efeito invertida)
- **COM-10**: Validade da proposta sem urgência ancorada

### Designer
- **DSG-04**: 27 pulse-dots animados infinite no mapa = ruído visual
- **DSG-05**: text-[10px] e text-[11px] falham legibilidade
- **DSG-06**: Contraste insuficiente em `text-emerald-200/40` sobre fundo emerald-950 (falha WCAG AA)
- **DSG-07**: Confete na tela "voltar à proposta" — invasivo, sem `prefers-reduced-motion`

### Security
- **SEC-03**: get_proposta_status confirma existência de propostas rascunho/cancelada (anônimo)
- **SEC-04**: Bucket propostas-pdf público + filename `PROP-XXXX-{Date.now()}.pdf` previsível → brute-force bypassa senha_link
- **SEC-05**: Race aceitar/recusar com edge function disparada dentro da transação

## 🟢 BAIXAS / Polimento

### Programador
- ITEM-06: Math.round divide por zero em modalidade preco_por_tipo
- ITEM-07: Polling sem feedback final após MAX_TENTATIVAS
- ITEM-08: `Number.isFinite` faltando em KPIs
- ITEM-09: SQL trigger PDF: race com pre-gerar
- ITEM-10: Cron lembrete usa data exata (pula se cron falhar)
- ITEM-11: Force light theme corrompe preferência salva
- ITEM-12: handleDownloadPDF console.error silencioso

### Security
- SEC-06: p_texto da recusa concatenado em notif sem escape (XSS-on-rendered se UI usa innerHTML)
- SEC-07: Cron usa created_at em vez de enviado_em
- SEC-08: trg_notif busca extensions.digest com fail-soft

### Outros
- DSG-08, DSG-09, DSG-10, DSG-11, DSG-12 (polimento visual)
- COM-07, COM-11, COM-12 (copy polimento)
- ITEM-13, ITEM-14, ITEM-15 (cleanup)

## Plano de ataque autônomo (próximas horas)

1. **SQL fixes** (1 arquivo só): SEC-01, SEC-02, SEC-03, SEC-06, SEC-07, ITEM-10
2. **Frontend críticos**: ITEM-01, ITEM-02, ITEM-04, ITEM-05, DSG-01, DSG-02, DSG-03
3. **Polimento UX**: DSG-04, DSG-06, DSG-07
4. **Copy**: COM-05 (reversibilidade modal aceite)
5. **#12 Upsell pacote mensal**
6. **#14 Página /dani**

Itens de prioridade baixa ficam pra próxima rodada.
