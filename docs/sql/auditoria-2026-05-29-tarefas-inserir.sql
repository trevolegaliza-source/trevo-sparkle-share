-- =============================================
-- AUDITORIA 29/05/2026 — Insere 48 tarefas no ERP
-- =============================================
-- Origem: auditoria multi-agente em 4 frentes (frontend, backend, schema, seg)
-- Documento consolidado: docs/auditoria-2026-05-29-FINAL.md
-- empresa_id: 2fa6a9bc-86f9-4831-9e76-c1fcd03f966d (Trevo Legaliza)
-- =============================================

INSERT INTO public.tarefas (empresa_id, titulo, descricao, categoria, prioridade, status, origem, achado_id) VALUES

-- ─── CRÍTICOS — Segurança ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-001] HMAC ausente em trello-label-lembrete', 'Edge function aceita qualquer POST sem validar assinatura Trello. Atacante posta payload addLabelToCard forjado pra disparar emails Resend a clientes (phishing + custo quota). Copiar bloco validateTrelloSignature do trello-guard/index.ts:86-115.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-001'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-002] enviar-email-mensalidade sem auth', 'Body {lancamento_id} dispara email Resend sem nenhuma autenticação. Atacante envia spam massivo (1000 lançamentos = 1000 emails). Adicionar token interno INTERNAL_TRIGGER_TOKEN comparado timing-safe.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-002'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-003] notify-cliente-evento sem auth', 'Mesma estrutura do AUDIT-002. 3 tipos email × N clientes = spam grátis até quebrar quota Resend e derrubar notificações reais de pagamento. Token interno.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-003'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-004] enviar-push sem validação de ownership', 'Recebe { title, body, url, subscriptions[] } direto do body. Push notification arbitrária pra qualquer subscription com URL controlada = phishing. Receber subscription_ids[] e validar user_id = caller.id.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-004'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-005] enviar-recibo-cobranca sem auth', 'Zero verificação. Qualquer pessoa passa cobranca_id e dispara notif master + marca recibo_enviado_em. Idempotência atenua mas não substitui auth.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-005'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-006] gerar-proposta-msa-pdf sem auth (2 versões)', 'Pode-se chamar com qualquer orcamento_id válido e forçar regeneração de PDF (custo PDFShift + Google Docs + Service Account quota). FULL e index antigo coexistem.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-006'),

-- ─── CRÍTICOS — Schema ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-007] RLS desabilitada em cobrancas_auditoria', 'ALTER TABLE cobrancas_auditoria ENABLE ROW LEVEL SECURITY + CREATE POLICY USING (empresa_id = get_user_empresa_id()). Hoje qualquer authenticated lê auditoria de qualquer empresa.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-007'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-008] View processos_zombies sem security_invoker', 'ALTER VIEW processos_zombies SET (security_invoker = on). Vaza dados de outras empresas se acessada por authenticated com RLS própria.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-008'),

-- ─── CRÍTICOS — Dados ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-009] 11 cobranças com lancamento_id orfão', 'Todas de maio/2026. 1 paga, 4 ativas, 5 vencidas, 1 cancelada. Lançamentos foram deletados (cascade processo? cleanup ADVANCE BPM 17/05?). Investigar causa, atualizar lancamento_ids removendo IDs órfãos OU recriar lançamentos a partir do extrato.', 'investigacao', 'critica', 'pendente', 'auditoria', 'AUDIT-009'),

-- ─── CRÍTICOS — Source of truth ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-010] 4 edges em prod sem source no repo', 'verify-master-password, provisionar-cliente-trello, trello-reconciliacao, trello-guard. Adicionar arquivos FULL.ts em docs/edge/ pra prevenir source-of-truth divergente.', 'manutencao', 'critica', 'pendente', 'auditoria', 'AUDIT-010'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-011] 8+ versões de get_proposta_por_token sem ordem documentada', 'CREATE OR REPLACE em 8 SQLs diferentes. Última executada vence. Consolidar num SQL canônico get_proposta_por_token-CANONICAL-29-05.sql e marcar os outros como historicos.', 'manutencao', 'critica', 'pendente', 'auditoria', 'AUDIT-011'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-012] gerar-proposta-msa-pdf 2 versões coexistindo', 'docs/edge/gerar-proposta-msa-pdf-index.ts (versão antiga, só PDFShift) + gerar-proposta-msa-pdf-FULL.ts (rewrite 26/05 com Google Docs). Risco de chamada confundir-se. Deletar index antigo.', 'manutencao', 'alta', 'pendente', 'auditoria', 'AUDIT-012'),

-- ─── MÉDIOS — Frontend ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-013] 3 componentes monstro >2000 LOC', 'ClienteDetalhe.tsx 2734, ClienteAccordionFinanceiro.tsx 2599, TerceirizacaoPublicaView.tsx 2056. Concentram bugs e re-renders agressivos. Quebrar em sub-componentes.', 'manutencao', 'alta', 'pendente', 'auditoria', 'AUDIT-013'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-014] 593 as any em mutações', 'Mascara typing Supabase. Risk de quebrar silenciosamente quando schema mudar. Concentrado em AuthContext, NotificationPopover, EtiquetasBadges, modais cartão. Regenerar types e usar tipagem direta.', 'manutencao', 'alta', 'pendente', 'auditoria', 'AUDIT-014'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-015] 15 window.confirm/alert em vez de AlertDialog', 'Inconsistência visual em ações destrutivas (Excluir proposta, Aprovar/Rejeitar acesso usuário). Locais: RichTextEditor.tsx:90, ContasReceberLista.tsx:95, ClientesAuditoria.tsx:538,1175, GestaoUsuarios.tsx:246,411,433, PropostasComerciais.tsx:266, TrelloCardsPendentes.tsx:129, Orcamentos.tsx:140.', 'manutencao', 'media', 'pendente', 'auditoria', 'AUDIT-015'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-016] 67 useMutation sem invalidateQueries', 'UI pode mostrar dado stale após mutação. 97 mutations total mas só 30 invalidações. Auditar caso-a-caso, especialmente fluxos financeiros.', 'bug', 'media', 'pendente', 'auditoria', 'AUDIT-016'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-017] ErrorBoundary único global', 'Crash em página derruba app inteiro até navegação. Adicionar boundaries por rota (especialmente Financeiro, Dashboard, ClienteDetalhe).', 'feature', 'media', 'pendente', 'auditoria', 'AUDIT-017'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-018] Hooks gigantes useFinanceiro 947 + useFinanceiroClientes 891 LOC', 'Provável useQuery aninhado disparando muitos fetches. Quebrar em hooks menores e memoizar resultados.', 'manutencao', 'media', 'pendente', 'auditoria', 'AUDIT-018'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-019] Cobertura Label em forms = 40%', '144 Label / 367 Input. Compromete screen readers. Revisar OrcamentoNovo.tsx, PropostaComercialNova.tsx, Configuracoes.tsx.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-019'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-020] 2 console.log ativos em prod', 'TerceirizacaoPublicaView.tsx:1140 (em página pública!) e PropostaComercialNova.tsx:325. Remover ou converter pra logger condicional.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-020'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-021] Hook órfão useSidebarCounts.ts', 'Não importado em lugar nenhum. Dead code confirmado. Deletar.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-021'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-022] TODOs Thales pendentes em AutoridadeBlocks.tsx', 'Linhas 17,356: "TODO Thales: validar números" e "substituir depoimentos por reais". Conteúdo do CEO em arquivo prod.', 'feature', 'media', 'pendente', 'auditoria', 'AUDIT-022'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-023] Skeletons faltam em Cartao.tsx + CartaoDetalhe.tsx', 'Renderiza estado vazio em loading sem indicador. Inconsistente com resto do app (105 Skeleton, 110 Loader2).', 'feature', 'baixa', 'pendente', 'auditoria', 'AUDIT-023'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-024] 2 img sem alt', 'ContractPreviewModal.tsx:59, PortfolioPublico.tsx:232 (página pública!). Adicionar alt.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-024'),

-- ─── MÉDIOS — Backend/Edges ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-025] 8 de 11 edges sem timeout em fetch externo', 'Trello, PDFShift, Google Docs. Pode travar wall-time 400s. Apenas asaas-gerar-cobranca, asaas-atualizar-vencimento, asaas-cancelar-cobranca têm AbortController 15s.', 'bug', 'alta', 'pendente', 'auditoria', 'AUDIT-025'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-026] Trello webhook retorna 200 em HMAC inválido', 'Mascara incidentes. Trello considera entregue, nunca retenta. Considerar retornar 401 (com risco do webhook ser desabilitado após 3 falhas).', 'bug', 'media', 'pendente', 'auditoria', 'AUDIT-026'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-027] DEBUG MODE Trello vazando hash em log', 'Comentário marca "29/05" — reverter após validação. Já feito hoje no commit final.', 'manutencao', 'baixa', 'feito', 'auditoria', 'AUDIT-027'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-028] RPCs sem SQL no repo', 'mark_cobranca_visualizada e calcular_vencimento criadas via Dashboard direto. Adicionar SQLs em docs/sql/ pra versionamento.', 'manutencao', 'alta', 'pendente', 'auditoria', 'AUDIT-028'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-029] 71/90 SQLs sem transação', 'Apenas 19 com BEGIN/ROLLBACK. Resto é CREATE OR REPLACE ad-hoc. Se algo falha no meio, fica inconsistente. Adotar template com transação.', 'manutencao', 'media', 'pendente', 'auditoria', 'AUDIT-029'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-030] 49 console.log em edges (asaas-webhook lidera com 22)', 'Ruído nos logs. Não catastrófico mas tagear como debug e ocultar em prod.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-030'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-031] 108 any types em edges', 'asaas-webhook (22) e gerar-proposta-msa-pdf-FULL (14) lideram. Tipar progressivamente.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-031'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-032] CORS inline duplicado em asaas-cancelar-cobranca', 'Não usa _shared/cors.ts. Refatorar pra usar helper compartilhado.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-032'),

-- ─── MÉDIOS — Schema ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-033] 14 policies auth_rls_initplan', 'Re-avaliam auth.uid() por linha. Wrap com (SELECT auth.uid()) pra cair em InitPlan e rodar 1x. Tabelas: notificacoes, push_subscriptions, master_password_attempts, profiles, mfa_recovery_codes, login_history, trello_card_events, financeiro_auditoria.', 'manutencao', 'media', 'pendente', 'auditoria', 'AUDIT-033'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-034] 3 policies múltiplas/permissivas no mesmo SELECT', 'empresas_config, financeiro_auditoria, profiles. Cada SELECT roda ambas e une — consolidar em 1.', 'manutencao', 'media', 'pendente', 'auditoria', 'AUDIT-034'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-035] 3 indexes duplicados', 'clientes (idx_clientes_asaas_customer vs _id), cobrancas (idx_cobrancas_cliente vs _id), orcamentos (idx_orcamentos_share vs _token). Drop 1 de cada.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-035'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-036] 17 FKs sem index', 'Lento em DELETE/JOIN. Maior impacto: asaas_webhook_events(cobranca_id), cobrancas(created_by, extrato_id), notificacoes(orcamento_id), prepago_movimentacoes(cliente_id, processo_id), proposta_eventos(orcamento_id), tarefas(created_by, completed_by), lancamentos(auditado_por, valor_alterado_por).', 'manutencao', 'media', 'pendente', 'auditoria', 'AUDIT-036'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-037] 3 backup tables de 20/04 sem PK', 'backup_extratos_20260420 (100), backup_lancamentos_20260420 (163), backup_valores_adicionais_20260420 (66). Janela rollback (39 dias) passou. Dropar.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-037'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-038] 41 unused indexes', 'Custo manutenção baixo em prod pequena (52 clientes / 174 processos). Manter por agora. Revisitar quando crescer.', 'manutencao', 'baixa', 'adiado', 'auditoria', 'AUDIT-038'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-039] login_history cresce ~2.6k/mês', 'Tabela maior já. Criar política retenção 90 dias via cron.', 'feature', 'baixa', 'pendente', 'auditoria', 'AUDIT-039'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-040] cobrancas com lancamento_ids inválidos', 'Cross-ref com AUDIT-009. Mesma raiz.', 'investigacao', 'critica', 'pendente', 'auditoria', 'AUDIT-040'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-041] tarefas e notificacoes com policies TO public', 'TO public inclui anon. USING ainda protege mas é bom estilo ajustar pra TO authenticated.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-041'),

-- ─── MÉDIOS — Segurança adicional ───
('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-042] dangerouslySetInnerHTML na proposta pública sem config DOMPurify', 'PropostaPublica.tsx:829,851,1203,1291,1365,1412,1547. Default DOMPurify permite a, img, svg, style. Master pode injetar markup pra alterar visual (engano cliente, troca PIX). Fix: ALLOWED_TAGS lista mínima.', 'bug', 'alta', 'pendente', 'auditoria', 'AUDIT-042'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-043] PDFs interpolam dados sem escape', 'relatorio-status-pdf.ts:39,56 e relatorio-prepago-pdf.ts:51,65,122. Razão social com <script> executa antes de virar canvas. Adicionar esc() helper como nos PDFs de contrato/extrato.', 'bug', 'alta', 'pendente', 'auditoria', 'AUDIT-043'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-044] portfolio_share_token legado aceita empresa_id', 'Comentário 17/05 dizia "remover 30 dias". Já passaram 12. Ex-funcionário acessa catálogo público de preços. Verificar via SQL quantas empresas ainda dependem do legado. Forçar geração de token novo.', 'manutencao', 'alta', 'pendente', 'auditoria', 'AUDIT-044'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-045] /tarefas sem RequirePermission', 'App.tsx:225. Vendedor/estagiário vê todas tarefas da empresa (RLS filtra por empresa_id mas vaza demais dentro do tenant). Adicionar RequirePermission ou criar módulo próprio "tarefas".', 'bug', 'media', 'pendente', 'auditoria', 'AUDIT-045'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-046] MASTER_PASSWORD env como fallback ainda ativo', 'verify-master-password/index.ts:117-135. Quando RPC retorna NULL, cai pra env plaintext. Verificar se hash já está set em prod. Se sim, REMOVER fallback inteiro.', 'bug', 'critica', 'pendente', 'auditoria', 'AUDIT-046'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-047] cobranca-pdf nunca expira token mesmo após pagamento', 'Link velho continua servindo PDF. Email antigo vaza extrato (CPF, valores, descrição) permanentemente. Rejeitar se status=paga e asaas_pago_em > 30 dias.', 'bug', 'media', 'pendente', 'auditoria', 'AUDIT-047'),

('2fa6a9bc-86f9-4831-9e76-c1fcd03f966d', '[AUDIT-048] Asaas webhook CORS *', 'asaas-webhook usa Access-Control-Allow-Origin: *. Server-to-server, então OK na prática (asaas-access-token autentica), mas documentar como aceito ou usar _shared/cors.ts.', 'manutencao', 'baixa', 'pendente', 'auditoria', 'AUDIT-048');

-- =============================================
-- 48 tarefas inseridas com prefixo [AUDIT-XXX]
-- Filtrar no /tarefas por categoria=auditoria pra ver tudo
-- =============================================
