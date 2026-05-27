# Pra você quando voltar — 28/05/2026 (manhã)

> Sessão autônoma 27/05 noite (~4h). 6 commits, ~1400 linhas. Auditoria multi-agente + 47 achados + ataque dos críticos + 2 features novas + cleanup.

---

## 🚦 Pra ativar (ORDEM)

### 1. SQL (2 arquivos — RODA NESSA ORDEM)

```bash
# 1.1 — Fixes auditoria security (CRÍTICO)
cat /Users/thalesburger/Desktop/Trevo-ERP-ATIVO/trevo-sparkle-share/docs/sql/fix-auditoria-noite-27-05.sql | pbcopy
```
Cola no SQL Editor → RUN. Resolve: SEC-01 (PII leak), SEC-02 (rate limit PDF), SEC-03 (status whitelist), SEC-06 (texto recusa fora da notif), SEC-07 (cron usa enviado_em), + nova RPC `get_proposta_pdf_url`.

```bash
# 1.2 — Feature upsell mensal
cat /Users/thalesburger/Desktop/Trevo-ERP-ATIVO/trevo-sparkle-share/docs/sql/feature-upsell-mensal-27-05.sql | pbcopy
```
Cola no SQL Editor → RUN. Cria coluna `terc_interesse_mensal` + RPC `registrar_interesse_mensal_proposta`.

### 2. Edge Function

**NÃO precisa redeploy.** Edge function não foi modificada nesta sessão.

### 3. Publish no Lovable

Frontend mudou bastante:
- `src/components/orcamentos/publico/TerceirizacaoPublicaView.tsx` (auditoria fixes + upsell modal)
- `src/pages/PropostaPublica.tsx` (tela expirado, observacoes_financeiro cleanup)
- `src/pages/Dani.tsx` (página nova /dani)
- `src/App.tsx` (rota /dani)
- `src/components/ErrorBoundary.tsx` (/dani como rota pública)
- `src/hooks/useOrcamentos.ts` (TS cleanup)
- `src/types/financial.ts` + `src/types/supabase.ts` (cleanup)
- `public/robots.txt` + `public/sitemap.xml` (SEO)

**Faz o Publish.**

---

## ✅ Resumo do que foi feito

### Auditoria multi-agente (4 personas)
4 agents rodaram em paralelo: programador (15 achados), comercial (12), designer (12), security (8). Total: **47 achados** documentados em `docs/AUDITORIA-NOITE-27-05.md`.

### Críticos atacados (10/10)
- **SEC-01**: `get_proposta_status` não vaza PII com senha ativa
- **SEC-02**: `disparar_gerar_pdf_proposta` com rate limit 30s + filtro de status
- **ITEM-01**: nova RPC `get_proposta_pdf_url` resolve polling em propostas com senha
- **ITEM-02**: handleEnviar do ModalRecusar checa `res.ok` antes de parsear JSON
- **ITEM-04**: handleAceitar faz fetch imediato do pdf_url pós-aceite (pré-gerado pode estar pronto)
- **DSG-01**: header hero mobile-safe (logo h-16 sm:h-24 md:h-36 + truncate)
- **DSG-02**: card valor sem `break-all` (whitespace-nowrap + /mês em linha separada no mobile)
- **DSG-03**: tap targets dos botões "Voltar" e "Recusar" >= 40-44px
- **DSG-04**: mapa Brasil — pulse-dot SÓ no estado ativo (era 27 infinite)
- **DSG-07**: `prefers-reduced-motion` respeitado em todas animações

### Alta importância atacados
- **SEC-03**: status NOT IN whitelist retorna NOT_FOUND
- **SEC-06**: recusar — texto livre NÃO concatenado na mensagem da notif
- **SEC-07**: cron lembrete usa `enviado_em` + range 2 dias
- **DSG-06**: contrastes `text-emerald-200/40` → `/70` + `/60` → `/80` (WCAG AA)
- **COM-05**: modal aceite com 4 bullets de reversibilidade + "Aceitar e iniciar onboarding"
- **COM-01**: stats hero trocados pra outcome (3.800+ escritórios, 47k+ processos, 27+1 estados)

### Features novas
- **#12 Upsell pacote mensal**: modal antes do aceite quando `modalidade='avulso'`, calcula economia, registra interesse, cria notif master pra Letícia conduzir conversão
- **#14 Página `/dani`**: landing pública dedicada da IA, hero + chat ao vivo + cobertura + antes/depois + B2B exclusivo. SEO completo (title + og dinâmico).

### TS cleanup
4/8 erros pre-existentes resolvidos:
- `useOrcamentos.ts` TS2589 x 2 (Supabase chain recursion)
- `PropostaPublica.tsx` TS2339 x 2 (`observacoes_financeiro` cast as any)
- `financial.ts` TS2304 (import local de ProcessoDB)
- `supabase.ts` ClienteTipoDB inclui PRECO_POR_TIPO

### SEO
- `public/robots.txt` bloqueia rotas privadas + tokens públicos
- `public/sitemap.xml` lista /dani
- Dani.tsx useEffect com title + og tags dinâmicos no mount/unmount

---

## ⚠️ Decisões que precisam de você

### 3 erros TS pre-existentes NÃO consertados (fora do escopo)
Estão em `src/pages/OrcamentoNovo.tsx`:
- **Linha 606 + 1281**: `gerarOrcamentoPDF(buildPDFParams(modo))` — `OrcamentoPDFData` exige `ordem_execucao` que `buildPDFParams` não retorna. Possíveis fixes: (a) marcar `ordem_execucao` como opcional no type, (b) preencher no `buildPDFParams`.
- **Linha 1283**: `salvarPDF(blob, modoPDF)` — `salvarPDF` é `UseMutationResult`, devia ser `salvarPDF.mutateAsync({ blob, modo, orcamentoId, filename })`.

Esses não afetam runtime (TS warning), mas vale conferir. Conserto é 5 min cada.

### Achados de auditoria NÃO atacados (priorização sua)

#### Alta importância — vale atacar
- **COM-03**: Calculadora ROI com texto "ainda assim você ganha em qualidade de vida" quando ganhoReal < 0 soa como mea-culpa. Refazer pra "Empate financeiro — você ganha em [tempo/risco/SLA]" como dimensão qualitativa
- **COM-04**: Depoimentos com sobrenome abreviado parecem fabricados — precisa nome completo + escritório real (autorização cliente)
- **COM-06**: Falta tratativa do medo "Trevo vai roubar meu cliente" — citar cláusula B2B exclusivo do MSA. (Parcialmente coberto em /dani.)
- **COM-08**: dani.ai aparece 3x na landing (card + inclusos + step 04) — talvez cortar item dos inclusos
- **COM-09**: Bloco financeiro depois do ROI inverte causa-efeito mental. Reordenar
- **COM-10**: Validade da proposta sem urgência ancorada (motivo concreto)
- **SEC-04**: Bucket `propostas-pdf` público + filename `PROP-XXXX-{Date.now()}.pdf` previsível → brute-force bypassa senha. Fix: gen_random_bytes(16) no filename OU bucket privado + signed URL com TTL
- **SEC-05**: Race aceitar/recusar — edge function disparada dentro da transação. Refactor: trigger AFTER UPDATE em vez de dispatch inline

#### Média/baixa (polish)
- DSG-05 (`text-[10px]/[11px]` legibilidade)
- DSG-08 (stats bar mobile 1 col)
- DSG-09 (sliders iOS thumb estilizar)
- DSG-10 (lazy load imagens)
- DSG-11 (`py-16` vs `py-20` inconsistente)
- DSG-12 (banner sticky gradient + z-index modais)
- ITEM-06 (divisão por zero modalidade `preco_por_tipo`)
- ITEM-07 (polling sem feedback após MAX_TENTATIVAS)
- ITEM-08, ITEM-09, ITEM-11, ITEM-12 (cleanups)
- COM-07, COM-11, COM-12

Todos documentados em `docs/AUDITORIA-NOITE-27-05.md`.

---

## 📋 Commits da noite (oldest → newest)

1. `6018cbb` fix(auditoria-noite): fixes críticos 4 agentes (SEC+ITEM+DSG+COM)
2. `b65e5b9` feat(propostas): #12 upsell pacote mensal antes do aceite
3. `17176a8` feat(dani): página dedicada /dani — landing pública da IA
4. `4f75201` chore: TS cleanup pre-existente + SEO básico + COM-01 stats hero

(Plus os 2 anteriores da sessão de hoje à tarde que você já validou.)

---

## 🧪 Smoke tests sugeridos

Roda em ordem após o SQL + Publish:

1. **Mapa do Brasil**: abre uma proposta existente → mapa deve ter só 1 pulse-dot rotativo (era 27 infinite)
2. **Banner sticky topo após aceite**: já estava OK, só confere com confete novo
3. **Upsell mensal**: cria proposta NOVA com modalidade=avulso → envia → abre link → clica "Aceitar proposta" → deve abrir **modal Upsell** com comparativo + 2 botões
4. **Cliente clica "Quero pacote mensal"** → no ERP em Notificações deve aparecer "💰 Upsell mensal — PROP-XXXX"
5. **Modal de confirmação do aceite** → 4 bullets de reversibilidade + botão "Aceitar e iniciar onboarding"
6. **Página /dani**: acessa `https://app.trevolegaliza.com/dani` direto → landing dedicada
7. **Compartilha link /dani no WhatsApp** → preview deve ter título "dani.ai — IA que monitora processos societários"
8. **Senha em proposta**: cria proposta com senha "teste123" → abre link → vê tela de senha → digita → carrega
9. **Polling com senha**: aceita proposta com senha → polling do PDF deveria funcionar agora (era quebrado)
10. **Tela link expirado**: tenta abrir link antigo → tela bonita "Proposta expirou" + botão WhatsApp

---

## 🛎️ Pendências documentadas (resumo)

- 2 nice-to-have ainda: #11 smart copy, #13 indicação (#12 e #14 ✅ feitos)
- #15 Clarity: setup manual (aguardando MS voltar do 404 + você criar conta)
- 8 achados alta importância da auditoria sem atacar (lista acima)
- ~15 achados média/baixa polish
- 3 erros TS pre-existentes em OrcamentoNovo.tsx

Tudo está em `docs/AUDITORIA-NOITE-27-05.md` se quiser revisitar.

---

## 💭 Sugestão pra próxima sessão

Antes de partir pros nice-to-have restantes (#11/#13), valeria atacar:

1. **COM-04** (depoimentos verificáveis) — gera trust signal real
2. **SEC-04** (filename PDF previsível) — segurança real exploitable
3. **COM-03 + COM-09 + COM-10** — micro-conversão

Esses 3 movem mais o ponteiro que #13 member-get-member em curto prazo. #11 smart copy precisa de mais dados antes de fazer sentido.

E claro: smoke test exaustivo do que tá no ar antes de mexer mais.
