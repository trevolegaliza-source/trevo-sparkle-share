-- ════════════════════════════════════════════════════════════════════════════
-- TAREFAS — ONDA FINANCEIRO 27/05/2026 (noite)
-- ════════════════════════════════════════════════════════════════════════════
-- 15 tarefas pra modernizar o departamento financeiro, priorizadas por ROI
-- real (não por dificuldade). Origem: brainstorm CFO+programador+UX 27/05.
--
-- Mapeamento prioridade → impacto:
--   crítica = quick wins de alto ROI (atacar nesta semana)
--   alta    = atacar nas próximas 2 semanas
--   media   = roadmap próximo mês
--   baixa   = se sobrar tempo / quando precisar
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Helper: empresa Trevo + created_by Thales
WITH ctx AS (
  SELECT
    'd8ea99ec-fae9-4738-a2fb-dd725490c609'::uuid as user_id,
    '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d'::uuid as empresa_id
)
INSERT INTO public.tarefas (
  empresa_id, titulo, descricao, categoria, prioridade, status, origem, created_by
)
SELECT empresa_id, titulo, descricao, 'financeiro', prioridade, 'pendente', 'claude', user_id
FROM ctx, (VALUES
  -- ─── CRÍTICAS (quick wins) ──────────────────────────────────────────────
  (1, 'critica',
   'FIN-001 · Tracking de abertura do link de cobrança',
   'Hoje você marca "enviado" manual mas não sabe se o cliente abriu o link, viu o boleto ou copiou o PIX. A infra _log_acesso_publico já existe.

ESCOPO:
- Trigger AFTER INSERT em acessos_publicos_log → UPDATE cobrancas SET visualizado_em=NOW() quando tipo=''cobranca''
- UI no card da cobrança: badge "✓ Cliente abriu há 2h" quando visualizado_em existe
- Filtro/tab: "Cobranças visualizadas mas não pagas" — Letícia liga ANTES do vencimento sabendo que viu

IMPACTO: conversão de pagamento +20% (ligação no momento certo).
ESFORÇO: ~1 dia.'),

  (2, 'critica',
   'FIN-002 · Régua de cobrança automática (D-3 / D+1 / D+5 / D+10)',
   'Hoje Letícia tem que LEMBRAR de cobrar atrasado. Cron diário dispara:
- D-3 vencimento → WhatsApp "vence dia X"
- D+1 vencido → "Identificamos vencimento ontem"
- D+5 → "Aberto há 5 dias, suspensão automática D+10"
- D+10 → Suspensão real no acesso plataforma

IMPLEMENTAÇÃO:
- pg_cron diário 09:00 BRT verificando cobranças
- Edge function enviar-lembrete-cobranca (template WhatsApp)
- Coluna cobrancas.regua_ativa (default true) — Letícia desliga por cliente se precisar
- Log de envios em tabela cobrancas_lembretes pra evitar dup

IMPACTO: Letícia recupera ~10h/semana. Inadimplência cai.
ESFORÇO: ~2 dias.'),

  (3, 'critica',
   'FIN-003 · Webhook PAYMENT_UPDATED do Asaas (sincronização)',
   'Listado no project_debitos_pos_viagem.md. Asaas dispara PAYMENT_UPDATED quando vencimento/valor é editado no painel deles. Nosso asaas-webhook ignora esse evento → banco desincroniza.

ESCOPO:
- Handler PAYMENT_UPDATED no asaas-webhook (já tem outros: PAYMENT_RECEIVED etc)
- Compara campos: dueDate, value, status
- UPDATE cobrancas com novos valores
- Cria notif master se mudança crítica

IMPACTO: evita constrangimento de mandar cobrança errada pro cliente.
ESFORÇO: ~4h.'),

  (4, 'critica',
   'FIN-004 · Score de pagamento por cliente',
   'Cliente paga sempre em dia? Atrasa 7 dias em média? Hoje você não sabe — Letícia "lembra" mas não está formalizado.

ESCOPO:
- Coluna clientes.score_pagamento numeric (0-100) calculada via trigger ao marcar cobrança como paga
- Fórmula: 100 - (média dias_atraso últimos 6 meses * 5), clamped 0-100
- Coluna clientes.atraso_medio_dias (info útil também)
- Badge no card cliente: 🟢 (>80) / 🟡 (50-80) / 🔴 (<50)
- Filtro no Financeiro: "Clientes com risco alto" (score < 50)

IMPACTO: decide quem aceitar pra mensalista vs pré-pago vs avulso com gate.
ESFORÇO: ~4h.'),

  -- ─── ALTAS ──────────────────────────────────────────────────────────────
  (5, 'alta',
   'FIN-005 · Dashboard financeiro DECISIONAL (DSO + churn + forecast)',
   'Hoje MRR view é parcial. Faltam métricas que CFO precisa:
- DSO (Days Sales Outstanding): média de dias até receber
- Churn rate mensal (clientes que pararam de pagar)
- Forecast 30/60/90 dias baseado em cobrança em aberto + histórico
- Ticket médio por cliente (e crescendo ou caindo MoM?)
- Top 10 clientes por receita (concentração de risco)
- Cohort retention por mês (clientes Jan vs Fev)

IMPACTO: você sabe pra onde o barco vai. Decisão baseada em dado, não feeling.
ESFORÇO: ~2 dias.'),

  (6, 'alta',
   'FIN-006 · Recibo automático após pagamento',
   'Cliente pagou (webhook Asaas dispara PAYMENT_RECEIVED) → ERP envia e-mail + WhatsApp com recibo PDF.

ESCOPO:
- Trigger AFTER UPDATE em cobrancas quando asaas_pago_em IS NOT NULL
- Edge function nova enviar-recibo-cobranca (usa lib/recibo.ts já existente pro PDF)
- Template e-mail/WhatsApp pré-pronto
- Marca recibo_enviado_em pra evitar dup

IMPACTO: profissionalismo + 1 ligação a menos por cliente.
ESFORÇO: ~1 dia.'),

  (7, 'alta',
   'FIN-007 · Margem por processo (receita - custo operacional)',
   'Cada processo tem custo real (taxa Junta, DARE, DARF, cartório, emolumentos). Hoje calcula só receita. Sem margem você não sabe quais TIPOS de processo dão lucro.

ESCOPO:
- Coluna processos.custo_total numeric (somatório de taxas)
- View processo_margem: honorário - custo_total
- Relatório por tipo de processo: "Abertura margem 72% vs Alteração 45%"
- Decisão estratégica: foco em tipo lucrativo

IMPACTO: redirecionamento estratégico de operação. Aceitar mais X, recusar Y.
ESFORÇO: ~1-2 dias.'),

  -- ─── MÉDIAS ─────────────────────────────────────────────────────────────
  (8, 'media',
   'FIN-008 · Limite de crédito por cliente',
   'Cliente acumulou R$ 10k em aberto sem pagar? Sistema bloqueia novo processo até quitar.

ESCOPO:
- Coluna clientes.limite_credito (default 5000)
- Trigger BEFORE INSERT em processos: verifica saldo_aberto > limite
- Se exceder, bloqueia + cria notif master "Cliente X tentou abrir processo mas excedeu limite"
- UI gestão de limite no card cliente

IMPACTO: evita rombo + dialogo proativo com cliente atrasado.
ESFORÇO: ~1 dia.'),

  (9, 'media',
   'FIN-009 · Auditoria de cobrança (log imutável)',
   'Quem gerou cobrança? Quem cancelou? Quem marcou como pago manual? Hoje invisível.

ESCOPO:
- Tabela cobrancas_auditoria (cobranca_id, user_id, acao, payload_anterior, payload_novo, created_at)
- Triggers AFTER INSERT/UPDATE em cobrancas
- UI dentro do "Ver cobrança": aba "Histórico" com timeline

IMPACTO: compliance + descobre fraude/erro interno se acontecer.
ESFORÇO: ~4h.'),

  (10, 'media',
   'FIN-010 · Provisão de receita (aceita vs realizada)',
   'Aceitar proposta ≠ receber dinheiro. Hoje conta como receita assim que faturado. Pra contabilidade limpa:
- "Receita aceita" (potencial)
- "Receita realizada" (paga)
- Provisão de devedores duvidosos (atraso > 60 dias)

ESCOPO:
- Views financeiras separadas
- Dashboard mostra ambos
- Útil pro contador da Trevo e pro balanço

IMPACTO: contador feliz, balanço correto, decisão de DRE com dado real.
ESFORÇO: ~2 dias.'),

  (11, 'media',
   'FIN-011 · Razão do atraso registrada (causa do não-pagamento)',
   'Cliente atrasou? Por que? Hoje some.

ESCOPO:
- Modal popup quando cliente bate atraso (D+1): "anotação opcional"
- Coluna cobrancas.motivo_atraso text + cobrancas.anotado_em
- Histórico no perfil cliente
- Análise: top 5 motivos de atraso = decide se ajusta produto, processo, comunicação

IMPACTO: inteligência operacional (não numérica).
ESFORÇO: ~4h.'),

  (12, 'media',
   'FIN-012 · Auto-conciliação PIX/transferência avulsa',
   'Cliente paga PIX direto (fora do Asaas) → Letícia marca manual. Match por valor + data via:
- Webhook do banco (Open Finance) OU
- Consulta pix recebido via Asaas/conta digital
- Sugestão automática de match no ERP — Letícia só confirma

IMPACTO: Letícia para de fazer match manual. Erro humano diminui.
ESFORÇO: ~3-4 dias (depende do provider).'),

  -- ─── BAIXAS (nice-to-have / longo prazo) ───────────────────────────────
  (13, 'baixa',
   'FIN-013 · NF-e/NFSe automática pós-pagamento',
   'Cobrança paga → emite NF automática via NFE.io ou similar e manda pro cliente.

ESCOPO:
- Conta NFE.io ou serviço equivalente
- Edge function emitir-nfe (consome webhook PAYMENT_RECEIVED)
- Coluna cobrancas.nf_url, cobrancas.nf_emitida_em
- Envio automático ao cliente via WhatsApp/email

IMPACTO: profissionalismo + compliance fiscal. Mas exige homologação trabalhosa.
ESFORÇO: ~3-5 dias (homologação NFE.io demora).'),

  (14, 'baixa',
   'FIN-014 · Score de saúde financeira (indicador único 🟢/🟡/🔴)',
   'Home do ERP mostra UM indicador grande baseado em:
- DSO < 5 dias
- Inadimplência < 5%
- Crescimento receita MoM positivo
- Churn < 3%/mês

Você abre o ERP, vê 🟢 = ok. Vê 🔴 = entra investigando antes de virar problema.

IMPACTO: dashboard executivo. Bom pra reunião com sócios também.
ESFORÇO: ~1 dia (depois de FIN-005 estar pronto).'),

  (15, 'baixa',
   'FIN-015 · Backup financeiro (plano B se Asaas cair)',
   'Se o Asaas cair amanhã, o que acontece? Documentar plano:
- Provider alternativo configurado (PagSeguro, Iugu, Gerencianet)
- Edge function asaas-gerar-cobranca preparada pra fallback via env switch
- Doc runbook do que fazer no incidente
- Teste de fire drill 1x/mês

IMPACTO: continuidade de negócio. Baixa probabilidade mas alto impacto se acontecer.
ESFORÇO: ~1 dia + custo de manter conta alternativa.')
) AS t(ordem, prioridade, titulo, descricao)
ORDER BY t.ordem;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  CASE prioridade
    WHEN 'critica' THEN '🔴 CRÍTICA'
    WHEN 'alta'    THEN '🟡 ALTA'
    WHEN 'media'   THEN '🟢 MÉDIA'
    WHEN 'baixa'   THEN '⚪ BAIXA'
  END as prioridade,
  COUNT(*) as total
FROM public.tarefas
WHERE categoria = 'financeiro'
  AND created_at > NOW() - INTERVAL '1 minute'
GROUP BY prioridade
ORDER BY MIN(CASE prioridade
  WHEN 'critica' THEN 1
  WHEN 'alta'    THEN 2
  WHEN 'media'   THEN 3
  WHEN 'baixa'   THEN 4
END);
