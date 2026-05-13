# 💼 Features de Gestor — Mindset CEO/CFO

> Thales pediu: *"TUDO AQUILO QUE EU NAO ENXERGO mas voce como excelentes features para colocar. Voce não é só coder, voce é meu gestor, gerente, dono."*
>
> Análise feita com chapéu de CEO/CFO de pequena empresa SaaS-like (regularização empresarial, ~50 clientes, 1 funcionário operacional + 1 gerente).

---

## 🎯 TOP 10 — features que eu instalaria primeiro se fosse dono

### 1. 💰 Dashboard MRR/ARR + Predição de receita (~3-4h)

**Problema atual:** o dashboard mostra "Faturado", "A Receber", "Recebido" do **mês corrente**. Não mostra:
- Receita previsível recorrente (mensalistas × mensalidade)
- Receita projetada do mês baseada em orçamentos enviados × taxa histórica
- Tendência últimos 6 meses

**Solução:**
- Card "MRR" = soma mensalidade dos clientes MENSALISTA ativos
- Card "Pipeline R$" = soma valor_final dos orçamentos com status='enviado' × taxa de conversão histórica
- Mini gráfico sparkline últimos 6 meses
- Alert "Você precisa fechar R$ X em N dias pra bater o mês passado"

**Valor:** previsibilidade de caixa. Saber se vai bater meta antes do dia 28. Tomar decisão de marketing/promoção a tempo.

---

### 2. 🚨 DSO (Days Sales Outstanding) + Top Inadimplentes (~2-3h)

**Problema atual:** vê "Total Vencido" mas não sabe **quanto tempo em média** demora receber. Sem isso, não dá pra negociar prazo melhor com cliente novo.

**Solução:**
- Card "DSO médio últimos 90 dias" — tempo entre `cobranca_gerada` e `pago` (em dias)
- Ranking "Top 5 inadimplentes" — cliente com mais R$ vencido / mais dias atrasado
- Alert "Este mês está pior que o anterior" se DSO subir
- Drill-in cliente → vê histórico de atrasos dele

**Valor:** identifica padrão "cliente X sempre paga atrasado 15d". Decisão de manter, exigir adiantamento, ou cobrar juros.

---

### 3. 🔄 Recurring billing automático pra mensalistas (~4-5h)

**Problema atual:** mensalistas pagam mensal mas TU tem que **gerar fatura manualmente** todo mês (botão "Gerar Fatura Mensal" no ClienteDetalhe). Alerta de "Mensalista sem fatura" foi entregue mas ainda é manual.

**Solução:**
- Edge function `cron-faturamento-mensal` agendada via Supabase Cron pra rodar todo dia
- Pra cada mensalista, se hoje = `dia_vencimento_mensal` AND não tem fatura no mês → criar lancamento + cobrança Asaas auto
- Notificação pro Thales: "5 faturas geradas hoje (R$ 12.500)"

**Valor:** elimina 1 hora/mês de trabalho manual. Mensalista nunca esquece de receber. Reduz erro humano.

---

### 4. 📱 Dani WhatsApp lembretes inteligentes (~3h)

**Problema atual:** depois que cobrança é gerada, fica esperando o cliente pagar. Não tem follow-up automático.

**Solução:**
- Cron diário verifica cobranças com `data_vencimento` em D-3, D-1, D-0, D+3, D+7
- Trigger edge function → manda mensagem Dani via WhatsApp pro cliente
- Template diferentes por estágio:
  - D-3: "Lembrete amistoso, cobrança vence sexta"
  - D-0: "Vence hoje, link aqui"
  - D+3: "Em atraso há 3 dias, link"
  - D+7: "Há 1 semana, posso ajudar?"
- Master ve histórico no ClienteDetalhe (timeline)
- Pode desativar por cliente (cliente VIP, ex-funcionário, etc)

**Valor:** reduz inadimplência sem você lembrar. Dani trabalha 24/7.

---

### 5. 📧 Notificações automáticas pro cliente em eventos chave (~2h)

**Problema atual:** cliente cadastra processo, fica em silêncio. Não sabe quando deferiu, quando cobrança saiu. Só tu sabe.

**Solução:**
- Trigger Postgres `notify_cliente_evento` em:
  - `processos.data_deferimento` muda de NULL → não-NULL (deferiu)
  - `cobrancas` INSERT (cobrança gerada)
  - `cobrancas.asaas_pago_em` muda (pagamento confirmado)
- Edge function manda email (Resend já configurado) + opcional WhatsApp Dani
- Cliente recebe: "Olá X, seu processo Y foi deferido! Próximo passo: ..."

**Valor:** cliente sente "uau, eles me atualizam sozinhos". Reduz "e aí, alguma novidade?" no WhatsApp.

---

### 6. 📊 "Hoje" view — único lugar com tudo que precisa fazer (~3h)

**Problema atual:** alertas espalhados — Dashboard tem alguns, Financeiro outros, Contas a Pagar outros. Não tem 1 view "o que urge hoje".

**Solução:**
- Nova rota `/hoje` (ou aba no Dashboard)
- 4 cards verticais:
  - **PRECISA AGIR HOJE** (vencimentos cobranças, pagamentos pendentes)
  - **EM RISCO** (cliente sumindo, processo parado >7d, contestações)
  - **OPORTUNIDADES** (orçamento enviado >5d sem resposta, mensalista expandindo, etc)
  - **CELEBRAR** (pagamento confirmado, cliente novo, meta batida)
- Cada card é actionable — clica e vai resolver direto

**Valor:** começa o dia sabendo o que importa. Não fica perdido no dashboard tentando achar o que precisa.

---

### 7. 🤖 Predição "vai bater o mês?" + sugestões (~2h)

**Problema atual:** vê total faturado mas não sabe se vai bater média/meta.

**Solução:**
- Card no Dashboard: "Faturamento projetado: R$ X (Y% acima/abaixo da média 3 meses)"
- Se abaixo: "Pra bater a média, fecha R$ Z em N dias"
- Sugestões:
  - "Você tem 5 orçamentos enviados há >7d — manda lembrete?"
  - "Cliente Z sempre fecha em janeiro, abre conversa?"
  - "12 mensalistas sem fatura mês — gerar lote?"

**Valor:** decisão de venda baseada em dado, não no chute.

---

### 8. 📋 Template de processos (~2-3h)

**Problema atual:** cadastrar processo "Abertura SP CNAE 4647-8/01" pede TODOS os campos do zero. Mas 80% dos campos são iguais entre processos do mesmo tipo.

**Solução:**
- Nova tabela `processo_templates`: nome + valor + observações + via_analise + tipo + etc
- UI em Configurações → "Templates"
- No Cadastro Rápido / Novo Processo: dropdown "Usar template" → preenche 80% dos campos
- Salvar como template a partir de processo existente

**Valor:** cadastra processo em 30s ao invés de 2min. Secretária ganha velocidade.

---

### 9. 🏦 Importar extrato bancário (OFX/CNAB) + conciliação (~5-6h)

**Problema atual:** Asaas conciliado, mas e dinheiro fora? PIX direto chave 39.969.412/0001-70, TED, cheque, dinheiro vivo? Tu tem que entrar e marcar pago manualmente.

**Solução:**
- Upload .ofx (formato Open Financial Exchange dos bancos) em `/financeiro` → Importar Extrato
- Parser server-side (edge function) lê transações
- UI mostra "matching" automático: transação ↔ lancamento pendente (por valor + data)
- Match >90% → auto-marca pago
- Match 50-89% → pede confirmação
- Sem match → "Receita não identificada" (ajusta manual)

**Valor:** 5 min/dia → 30 seg. Acaba "esqueci de marcar pago" → cliente recebe lembrete sem precisar.

---

### 10. 📅 Calendário visual de prazos (~3-4h)

**Problema atual:** vencimentos espalhados em listas. Não dá pra ver "essa semana tem 8 vencimentos, vou bater quando?".

**Solução:**
- Nova rota `/calendario` com calendar component
- Marca eventos:
  - 💰 Cobranças vencendo (cor por valor)
  - 💸 Contas a pagar vencendo
  - 📅 Mensalistas com dia de cobrança
  - 🎂 Aniversário cliente (oportunidade de saudação)
  - 🎂 Aniversário colaborador
  - 📋 Prazos legais (se tiver)
- Click evento → drill-in
- Mês/semana/dia view

**Valor:** visão temporal que listas não dão. Detecta "semana de fogo" antes.

---

## 🥈 Tier 2 — Features de impacto médio

### 11. NPS pós-pagamento (~1h)
Após cobrança paga, manda email "De 0 a 10, recomenda?". Métrica anual.

### 12. Cohort analysis (~2h)
Tabela "Clientes adquiridos em jan/2025 ainda ativos: X de Y (Z%)". Mostra retenção.

### 13. Indicação cliente (referral, ~3h)
Cliente indica outro → bônus pra ambos (R$ X off na próxima). Tabela `referrals`.

### 14. Atalhos de teclado expandidos (~1h)
- Cmd+N: Novo cliente (no /clientes), Novo processo (em ClienteDetalhe)
- Cmd+S: Salvar form
- Cmd+/: Help
- Esc: Fechar modal

### 15. Bulk export CSV/Excel (~2h)
- Lista de clientes → exportar
- Lista de processos → exportar
- Histórico financeiro mês → exportar pra contabilidade
- Já tem `export-utils.ts` mas pouco usado

### 16. Snippets de mensagem (~2h)
Banco de mensagens WhatsApp/email pré-prontas. Click insere com placeholders {{nome}} {{valor}}.

### 17. "Cliente sumindo" alerta (~1h)
Cliente sem processo novo há 60d + sem cobrança pendente = risco churn. Card no Dashboard.

### 18. Margem por tipo de processo (~2h)
Relatório DRE expandido: qual tipo (abertura/alteração/etc) dá mais margem em média? Decisão de pricing.

### 19. Onboarding wizard primeiro acesso (~2h)
User novo (gerente/operacional) faz tour guiado: "Aqui você cadastra cliente, aqui processo, etc."

### 20. Tour interativo Help (~2h)
Botão "?" no header → tooltips contextuais em cada tela. Não atrapalha quem já sabe.

---

## 🥉 Tier 3 — Features futuras (efeito longo prazo)

### 21. PWA / Mobile app (~6h)
ERP funciona como app instalável no celular. Notificações push.

### 22. Consulta CNPJ via Receita Federal (~3h)
Cadastrar cliente: digita CNPJ → preenche nome/endereço auto (API gratuita BrasilAPI).

### 23. Junta Comercial integração (~grande)
Status real do processo na Jucesp (web scraping ou API se houver). Atualiza data_deferimento sozinho.

### 24. Open Banking conta corrente (~10h+)
Plugar conta bancária via Pluggy/Belvo. Vê saldo real-time, conciliação automática.

### 25. Portal do cliente (~10h+)
Cliente loga e vê dele: processos, cobranças, histórico, documentos. Self-service.

### 26. Chat in-app com Dani (~5h)
Substitui WhatsApp por chat embutido no portal cliente. Dani responde dúvidas comuns.

### 27. Tracking UTM em propostas (~2h)
Link público gerado com `?utm_source=instagram`. Sabe de onde vem cada cliente.

### 28. A/B test de propostas (~4h)
2 versões do PDF/link interativo → mede qual converte mais.

### 29. Avaliação fornecedores (~2h)
Cada despesa de fornecedor → notar com estrelas. Ranking dos melhores.

### 30. Plano de contas com IA (~3h)
LLM categoriza despesa automaticamente baseada na descrição (folha vs infra vs marketing).

---

## 📊 Ranking por ROI estimado (subjetivo, ordenado)

| # | Feature | Esforço | Valor pra ti | ROI |
|---|---|---|---|---|
| 1 | MRR Dashboard | 3-4h | 🔥🔥🔥 | ⭐⭐⭐⭐⭐ |
| 3 | Recurring billing auto | 4-5h | 🔥🔥🔥 | ⭐⭐⭐⭐⭐ |
| 4 | Lembretes Dani WhatsApp | 3h | 🔥🔥🔥 | ⭐⭐⭐⭐⭐ |
| 6 | "Hoje" view | 3h | 🔥🔥🔥 | ⭐⭐⭐⭐⭐ |
| 5 | Notif auto pro cliente | 2h | 🔥🔥 | ⭐⭐⭐⭐ |
| 2 | DSO + Top inadimplentes | 2-3h | 🔥🔥 | ⭐⭐⭐⭐ |
| 9 | Import OFX bancário | 5-6h | 🔥🔥 | ⭐⭐⭐⭐ |
| 8 | Template processos | 2-3h | 🔥🔥 | ⭐⭐⭐⭐ |
| 7 | Predição "bater o mês?" | 2h | 🔥🔥 | ⭐⭐⭐ |
| 10 | Calendário visual | 3-4h | 🔥🔥 | ⭐⭐⭐ |
| 17 | Cliente sumindo | 1h | 🔥 | ⭐⭐⭐ |
| 14 | Atalhos teclado | 1h | 🔥 | ⭐⭐⭐ |
| 15 | Bulk export CSV | 2h | 🔥 | ⭐⭐⭐ |
| 16 | Snippets mensagem | 2h | 🔥 | ⭐⭐⭐ |
| 18 | Margem por tipo | 2h | 🔥 | ⭐⭐ |
| 11 | NPS pós-pagamento | 1h | — | ⭐⭐ |
| 12 | Cohort analysis | 2h | — | ⭐⭐ |
| 13 | Referral program | 3h | — | ⭐⭐ |
| 19 | Onboarding wizard | 2h | — | ⭐⭐ |
| 22 | Consulta CNPJ Receita | 3h | 🔥 | ⭐⭐⭐ |

---

## 🎯 Sugestão de roadmap (próximas 5 sessões)

**Sessão 1 — Receita/Caixa (8h):** MRR Dashboard + DSO + Recurring billing auto.
**Sessão 2 — Cliente (5h):** Lembretes Dani WhatsApp + Notif auto pro cliente.
**Sessão 3 — Produtividade (6h):** "Hoje" view + Template processos.
**Sessão 4 — Conciliação (6h):** Import OFX bancário.
**Sessão 5 — Visão (5h):** Calendário visual + Predição mês.

**Total: ~30h pra implementar TOP 10. Distribuído em 5 sessões dedicadas, com tu testando entre cada uma.**

---

## ❓ Decisões pendentes

Pra eu atacar qualquer um, preciso:
- **#3 Recurring billing:** validar regra exata. Se mensalista tem `dia_vencimento_mensal=10`, gera dia 10 ou D-5 (pra cliente pagar antes)? Faz 1 fatura mês ou trimestre/anual?
- **#4 Lembretes Dani:** quais templates? Quão "agressivo" pode ser?
- **#5 Notif auto cliente:** quais eventos? Email + WhatsApp ou só um?
- **#6 "Hoje" view:** substitui Dashboard ou adiciona como aba?
- **#8 Template processos:** quem cria templates? Master only ou todos?
- **#9 Import OFX:** algum banco específico (Inter, Itaú)?

**Próximo passo:** tu lê esse doc, escolhe TOP 3 pra atacar primeiro, e fazemos sessão dedicada por feature.

---

*Criado em 13/05/2026 noite — sessão autônoma 10h. Próxima leitura sugerida: o mapa mental do sistema (docs/mapa-mental/01..05) que vai te dar contexto técnico pra essas features.*
