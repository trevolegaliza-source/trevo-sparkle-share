-- =============================================
-- Notif master quando funcionário cria processo/orçamento (18/05/2026 — Bloco 4)
-- =============================================
-- Thales viaja 19/05. Enquanto fora, Letícia/Michele vão criar processos
-- e orçamentos. Pra ele ter visibilidade sem ter que abrir o ERP toda hora,
-- quando funcionário (não-master) CRIA processo ou orçamento, dispara
-- notificação no sino do master:
--   "👤 Letícia criou processo R$ 1.200 pra ADVANCE BPM"
--   "👤 Michele criou orçamento pra LUANNA"
--
-- Master criando coisas próprias NÃO gera notif (evita auto-spam).
-- Edits também NÃO geram (escopo controlado — só criação).
-- =============================================

-- Helper compartilhado: notifica master da empresa
CREATE OR REPLACE FUNCTION public._notif_master_func_criou(
  p_empresa_id uuid,
  p_ator_id uuid,
  p_tipo_evento text,
  p_titulo text,
  p_mensagem text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master_id uuid;
  v_ator_role text;
BEGIN
  -- Se ator é o próprio master, não notifica (evita auto-spam)
  SELECT role INTO v_ator_role FROM public.profiles WHERE id = p_ator_id;
  IF v_ator_role = 'master' THEN
    RETURN;
  END IF;

  -- Pega master da empresa
  v_master_id := public.get_empresa_master_id(p_empresa_id);
  IF v_master_id IS NULL OR v_master_id = p_ator_id THEN
    RETURN;
  END IF;

  -- Cria notif
  INSERT INTO public.notificacoes (
    empresa_id, destinatario_id, tipo, titulo, mensagem, lida
  ) VALUES (
    p_empresa_id, v_master_id, p_tipo_evento, p_titulo, p_mensagem, false
  );
END;
$$;

-- Trigger AFTER INSERT em processos
CREATE OR REPLACE FUNCTION public.tg_notif_master_processo_criado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_nome text;
  v_ator_nome text;
  v_titulo text;
  v_mensagem text;
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Snapshot do cliente e do ator
  SELECT COALESCE(apelido, nome, 'Cliente') INTO v_cliente_nome
  FROM public.clientes WHERE id = NEW.cliente_id;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_ator_nome
  FROM public.profiles WHERE id = NEW.created_by;

  v_titulo := '👤 ' || COALESCE(v_ator_nome, 'Funcionário') || ' criou processo';
  v_mensagem := COALESCE(v_ator_nome, 'Funcionário') || ' cadastrou processo "' ||
                COALESCE(NEW.razao_social, '—') || '" pra ' ||
                COALESCE(v_cliente_nome, 'cliente') ||
                CASE WHEN NEW.valor > 0 THEN ' (R$ ' || to_char(NEW.valor, 'FM999G999G990D00') || ')' ELSE '' END;

  PERFORM public._notif_master_func_criou(
    NEW.empresa_id, NEW.created_by, 'processo_criado_por_func', v_titulo, v_mensagem
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_master_processo_criado ON public.processos;
CREATE TRIGGER trg_notif_master_processo_criado
AFTER INSERT ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.tg_notif_master_processo_criado();

-- Trigger AFTER INSERT em orcamentos
CREATE OR REPLACE FUNCTION public.tg_notif_master_orcamento_criado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator_id uuid;
  v_ator_nome text;
  v_titulo text;
  v_mensagem text;
BEGIN
  -- orcamentos.created_by é text (armazena uuid como string)
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_ator_id := NEW.created_by::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_ator_nome
  FROM public.profiles WHERE id = v_ator_id;

  v_titulo := '👤 ' || COALESCE(v_ator_nome, 'Funcionário') || ' criou orçamento';
  v_mensagem := COALESCE(v_ator_nome, 'Funcionário') || ' cadastrou orçamento pra "' ||
                COALESCE(NEW.prospect_nome, '—') || '"' ||
                CASE WHEN NEW.valor_final > 0
                  THEN ' (R$ ' || to_char(NEW.valor_final, 'FM999G999G990D00') || ')'
                  ELSE '' END;

  PERFORM public._notif_master_func_criou(
    NEW.empresa_id, v_ator_id, 'orcamento_criado_por_func', v_titulo, v_mensagem
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_master_orcamento_criado ON public.orcamentos;
CREATE TRIGGER trg_notif_master_orcamento_criado
AFTER INSERT ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_notif_master_orcamento_criado();

-- Confirma
SELECT count(*) AS triggers_ativos
FROM pg_trigger
WHERE tgname IN ('trg_notif_master_processo_criado', 'trg_notif_master_orcamento_criado');
