-- ════════════════════════════════════════════════════════════════════════════
-- Feature: Tarefas (checklist na sidebar)
-- ════════════════════════════════════════════════════════════════════════════
-- Single source of truth pra pendências do ERP (testes, débitos, ideias).
-- Substitui consulta manual aos 7+ docs .md espalhados pelo repo.
--
-- Como Claude popula: via MCP do Supabase ao finalizar auditoria/sessão.
-- Cada achado/teste vira INSERT em `tarefas` com `origem='claude'` +
-- `arquivo_md` apontando pro doc onde tá o contexto completo.
--
-- Como Thales usa: aba "Tarefas" no sidebar com badge contador. Marca
-- como feito inline (checkbox). Adiciona nova via botão "+Nova" (modal).
-- Real-time via Realtime do Supabase — Claude insere e ele vê na hora.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Tabela
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,

  -- Conteúdo
  titulo text NOT NULL CHECK (length(titulo) > 0 AND length(titulo) <= 200),
  descricao text CHECK (descricao IS NULL OR length(descricao) <= 4000),
  categoria text NOT NULL CHECK (categoria IN (
    'bug', 'feature', 'teste', 'auditoria', 'manutencao', 'investigacao', 'outro'
  )),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN (
    'critica', 'alta', 'media', 'baixa'
  )),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'em_andamento', 'feito', 'cancelado', 'adiado'
  )),

  -- Metadata pra rastreabilidade
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('claude', 'manual', 'auditoria')),
  arquivo_md text,                -- ex: 'docs/auditoria-2026-05-25/00-RESUMO.md'
  commit_sha text,                -- ex: 'b1e9559'
  achado_id text,                 -- ex: 'SEC-038'

  -- Timestamps + autoria
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────────────
-- 2. Índices (queries comuns: por status, por prioridade-pendentes, busca)
-- ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tarefas_empresa_status_idx
  ON public.tarefas (empresa_id, status);

CREATE INDEX IF NOT EXISTS tarefas_pendentes_prioridade_idx
  ON public.tarefas (empresa_id, prioridade)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS tarefas_categoria_idx
  ON public.tarefas (empresa_id, categoria);

-- ──────────────────────────────────────────────────────────────────────
-- 3. Triggers: updated_at + completed_at automáticos
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_tarefas_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarefas_updated_at ON public.tarefas;
CREATE TRIGGER tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarefas_set_updated_at();

-- Quando muda pra 'feito', popula completed_at + completed_by automaticamente.
-- Quando volta pra outro status, limpa. Evita inconsistência manual.
CREATE OR REPLACE FUNCTION public.tg_tarefas_handle_completion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'feito' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'feito') THEN
    NEW.completed_at = COALESCE(NEW.completed_at, NOW());
    NEW.completed_by = COALESCE(NEW.completed_by, auth.uid());
  ELSIF NEW.status <> 'feito' THEN
    NEW.completed_at = NULL;
    NEW.completed_by = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarefas_completion ON public.tarefas;
CREATE TRIGGER tarefas_completion
  BEFORE INSERT OR UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tg_tarefas_handle_completion();

-- ──────────────────────────────────────────────────────────────────────
-- 4. RLS — isolamento por tenant. Permissivo dentro da empresa.
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarefas_select ON public.tarefas;
CREATE POLICY tarefas_select ON public.tarefas FOR SELECT
  USING (empresa_id = get_empresa_id());

DROP POLICY IF EXISTS tarefas_insert ON public.tarefas;
CREATE POLICY tarefas_insert ON public.tarefas FOR INSERT
  WITH CHECK (empresa_id = get_empresa_id());

DROP POLICY IF EXISTS tarefas_update ON public.tarefas;
CREATE POLICY tarefas_update ON public.tarefas FOR UPDATE
  USING (empresa_id = get_empresa_id());

-- DELETE: permissivo por tenant (igual outras tabelas operacionais antes da
-- refactor). Tarefa não é dado sensível como financeiro.
DROP POLICY IF EXISTS tarefas_delete ON public.tarefas;
CREATE POLICY tarefas_delete ON public.tarefas FOR DELETE
  USING (empresa_id = get_empresa_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- 5. Realtime — Thales vê nova tarefa do Claude na hora
-- ──────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.tarefas;

-- ──────────────────────────────────────────────────────────────────────
-- 6. Popular tarefas iniciais (smoke tests + débitos abertos)
-- ──────────────────────────────────────────────────────────────────────
-- Pega empresa_id dinamicamente (assume 1 empresa configurada).
DO $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.empresas_config LIMIT 1;
  IF v_empresa_id IS NULL THEN
    RAISE NOTICE 'Sem empresa_config — pulando popular tarefas iniciais';
    RETURN;
  END IF;

  -- ── Smoke tests críticos (auditoria 25/05)
  INSERT INTO public.tarefas (empresa_id, titulo, descricao, categoria, prioridade, origem, arquivo_md, achado_id) VALUES
    (v_empresa_id, 'Testar SEC-033: senha proposta via curl/DevTools',
     'Abrir proposta com senha cadastrada via curl direto à RPC. Resposta deve ser vazia (sem dados em memória). Digitar senha correta → dados aparecem.',
     'teste', 'critica', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'SEC-033'),

    (v_empresa_id, 'Testar SEC-034: push lockscreen sem nome+R$',
     'Criar processo qualquer → confirmar push no lockscreen do iPhone com texto GENÉRICO ("⚙️ Novo processo cadastrado") em vez de nome cliente + valor.',
     'teste', 'critica', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'SEC-034'),

    (v_empresa_id, 'Testar SEC-037: RPC criar_notificacao_proposta deletada',
     'curl POST /rest/v1/rpc/criar_notificacao_proposta → deve retornar 404 "function does not exist".',
     'teste', 'critica', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'SEC-037'),

    (v_empresa_id, 'Testar SEC-038: _notif_master_func_criou sem PUBLIC',
     'curl POST como anon deve retornar 401/403. Triggers internas continuam OK — criar processo como funcionário e verificar que master ainda recebe notif.',
     'teste', 'critica', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'SEC-038'),

    (v_empresa_id, 'Testar SEC-039: criar_evento_proposta exige share_token',
     'curl com p_orcamento_id (assinatura antiga) → erro de parameter mismatch. Recusar proposta no link público → log gravado em proposta_eventos.',
     'teste', 'critica', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'SEC-039'),

    (v_empresa_id, 'Testar RLS DELETE com Letícia/Michele',
     'Logar como elas → deletar processo teste (funciona, pode_excluir=true). Tentar deletar lançamento → bloquear (pode_excluir=false em financeiro).',
     'teste', 'critica', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', NULL),

  -- ── Smoke tests altos (features de 25/05)
    (v_empresa_id, 'Testar editar vencimento Asaas (FIN-009)',
     'Cobrança PENDING → "Detalhes" → "Editar vencimento" → mudar data. Asaas e ERP devem sincronizar. SELECT entidade_audit WHERE campo=data_vencimento mostra entry.',
     'teste', 'alta', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'FIN-009'),

    (v_empresa_id, 'Testar webhook PAYMENT_UPDATED reverso',
     'Editar dueDate DIRETO no painel Asaas → ERP sincroniza em ~5s + master recebe notif "📅 Vencimento alterado no Asaas".',
     'teste', 'alta', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', NULL),

    (v_empresa_id, 'Testar Preços por Tipo (caso VITAE)',
     'Cliente VITAE → "Preços diferenciados por tipo" → adicionar abertura R$ 540 → criar processo de abertura → valor final = R$ 540.',
     'teste', 'alta', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', NULL),

    (v_empresa_id, 'Testar histórico mascarado pra operacional (PERM-015)',
     'Logar como Letícia → abrir orçamento com mudança de valor → "Histórico" → ver ••••• em vez de R$.',
     'teste', 'alta', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'PERM-015'),

    (v_empresa_id, 'Testar notif master ao recusar proposta (trigger Sessão E)',
     'Cliente recusa proposta via link público → master recebe notif "🔴 Proposta recusada".',
     'teste', 'alta', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', NULL),

  -- ── Smoke tests médios
    (v_empresa_id, 'Testar push unread per user (SEC-035)',
     'Com 2+ masters cadastrados, gerar notif → cada um vê badge correto (não inflado pela soma).',
     'teste', 'media', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'SEC-035'),

    (v_empresa_id, 'Testar push unsubscribe ordem (SEC-036)',
     'Ativar push → desativar → reativar. SELECT * FROM push_subscriptions deve mostrar sem duplicata/órfão.',
     'teste', 'media', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'SEC-036'),

    (v_empresa_id, 'Testar upsert Preços por Tipo (CODE-011)',
     'Adicionar mesmo preço duas vezes → sem erro de duplicata. count(*) = 1.',
     'teste', 'media', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'CODE-011'),

    (v_empresa_id, 'Testar cache 10s (UX-150)',
     'Abrir Financeiro → trocar de aba 30s → voltar → não recarrega. Após 1min+ → recarrega.',
     'teste', 'media', 'claude', 'docs/auditoria-2026-05-25/TESTES-PENDENTES.md', 'UX-150'),

  -- ── Débitos arquiteturais adiados
    (v_empresa_id, 'RLS UPDATE refactor — análogo ao DELETE',
     'Criar tem_permissao_editar(modulo) + trocar policies UPDATE de tabelas operacionais. Adiado: Letícia/Michele têm pode_editar=false em financeiro. Pré-requisito: revisar/popular user_permissions OU validar que UPDATE não cascateia indiretamente. Validei zero triggers em UPDATE — risco menor que estimado. ~2-3h acompanhada.',
     'manutencao', 'media', 'claude', 'docs/auditoria-2026-05-25/00-RESUMO.md', NULL),

    (v_empresa_id, 'CODE-012: trigger push fire-and-forget',
     'ACEITO como trade-off. Trigger AFTER INSERT em notificacoes chama net.http_post. Se transação rollback, push já saiu. Rollback de notif é raríssimo. Solução robusta (cron) custa ~3h. Reabrir só se aparecer dor.',
     'manutencao', 'baixa', 'claude', 'docs/auditoria-2026-05-25/00-RESUMO.md', 'CODE-012'),

    (v_empresa_id, 'Trello checklist deletado por engano',
     'Memo 18/05 cita meninas marcam etapa antes da hora no Trello, ERP só registra. Escopo VAGO — Thales precisa descrever caso real antes de atacar.',
     'investigacao', 'baixa', 'manual', NULL, NULL),

    (v_empresa_id, 'Decidir mapas mentais untracked',
     'docs/mapa-mental/01-05.md estão untracked. Decidir: commitar ou descartar.',
     'manutencao', 'baixa', 'manual', NULL, NULL),

  -- ── Investigações
    (v_empresa_id, 'Validar PF + Asaas com caso real',
     'Edge asaas-gerar-cobranca v22 suporta tipo_pessoa=PF (validação CPF 11 dig). Falta validar com cliente PF real gerando boleto/PIX.',
     'investigacao', 'baixa', 'claude', 'docs/auditoria-2026-05-25/00-RESUMO.md', NULL),

    (v_empresa_id, 'Validar RLS DELETE com 3º usuário',
     'Refactor aplicado com pré-flight em 2 não-masters (Letícia, Michele). Cadastrar 3º usuário e testar comportamento antes de declarar OK total.',
     'investigacao', 'baixa', 'claude', 'docs/auditoria-2026-05-25/00-RESUMO.md', NULL);
END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 7. Verificação
-- ──────────────────────────────────────────────────────────────────────
SELECT count(*) AS total_tarefas_criadas,
       count(*) FILTER (WHERE prioridade = 'critica') AS criticas,
       count(*) FILTER (WHERE prioridade = 'alta') AS altas,
       count(*) FILTER (WHERE prioridade = 'media') AS medias,
       count(*) FILTER (WHERE prioridade = 'baixa') AS baixas
  FROM public.tarefas;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (se quiser remover tudo):
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.tarefas;
-- DROP TABLE public.tarefas CASCADE;
-- DROP FUNCTION public.tg_tarefas_set_updated_at();
-- DROP FUNCTION public.tg_tarefas_handle_completion();
-- COMMIT;
