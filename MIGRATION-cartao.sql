-- ===========================================================================
-- Migration: Entidade Cartão (cartoes + cartao_compras + cartao_faturas)
-- Demanda Thales 04/05/2026 noite: substituir workaround "prefixar fornecedor
-- com Cartão Trevo - " por entidade nativa.
--
-- Modelo:
--   cartoes        — cadastro do cartão (1+ por empresa)
--   cartao_compras — cada PARCELA é uma row (compra 6x = 6 rows com
--                    compra_grupo_id em comum)
--   cartao_faturas — 1 fatura por cartão por mês de vencimento;
--                    quando fechada, cria 1 row em lancamentos (Contas a Pagar)
--
-- RLS: segue o pattern atual do resto do sistema (auth-only). Quando os
-- itens C28–C32 da auditoria forem resolvidos, fechar para `empresa_id`
-- também aqui.
--
-- IDEMPOTENTE: usa CREATE TABLE IF NOT EXISTS — pode rodar 2x sem quebrar.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) cartoes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  nome text NOT NULL,
  bandeira text,
  ultimos_4 text,
  dia_fechamento int NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento int NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  limite numeric(14,2),
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cartoes IS
  'Cartões de crédito da empresa. Suporta múltiplos cartões. Vencimento e fechamento configuráveis.';

-- ---------------------------------------------------------------------------
-- 2) cartao_faturas (criada antes de cartao_compras pra FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartao_faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  cartao_id uuid NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
  data_fechamento date NOT NULL,
  data_vencimento date NOT NULL,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga')),
  lancamento_id uuid,  -- FK para lancamentos preenchido no fechamento (sem REFERENCES pra evitar dep cíclica)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cartao_id, data_vencimento)
);

COMMENT ON TABLE cartao_faturas IS
  'Faturas mensais. Status: aberta (acumulando compras) → fechada (lançamento criado em Contas a Pagar) → paga.';

-- ---------------------------------------------------------------------------
-- 3) cartao_compras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cartao_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  cartao_id uuid NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
  data_compra date NOT NULL,
  descricao text NOT NULL,
  fornecedor text,
  valor_total numeric(14,2) NOT NULL,
  parcelas_total int NOT NULL DEFAULT 1 CHECK (parcelas_total >= 1),
  parcela_numero int NOT NULL DEFAULT 1 CHECK (parcela_numero >= 1),
  valor_parcela numeric(14,2) NOT NULL,
  fatura_vencimento date NOT NULL,
  categoria text,
  centro_custo text,
  observacoes text,
  compra_grupo_id uuid,
  cartao_fatura_id uuid REFERENCES cartao_faturas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parcela_numero <= parcelas_total)
);

COMMENT ON TABLE cartao_compras IS
  'Cada PARCELA é uma row. Compra 6x → 6 rows com mesmo compra_grupo_id, fatura_vencimento incrementando mês a mês.';

-- ---------------------------------------------------------------------------
-- 4) Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cartao_compras_cartao_fatura
  ON cartao_compras(cartao_id, fatura_vencimento);

CREATE INDEX IF NOT EXISTS idx_cartao_compras_grupo
  ON cartao_compras(compra_grupo_id) WHERE compra_grupo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cartao_compras_fatura_id
  ON cartao_compras(cartao_fatura_id) WHERE cartao_fatura_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cartao_faturas_cartao_status
  ON cartao_faturas(cartao_id, status);

-- ---------------------------------------------------------------------------
-- 5) Trigger updated_at (segue padrão do resto do schema)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cartoes_updated ON cartoes;
CREATE TRIGGER trg_cartoes_updated
  BEFORE UPDATE ON cartoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cartao_compras_updated ON cartao_compras;
CREATE TRIGGER trg_cartao_compras_updated
  BEFORE UPDATE ON cartao_compras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cartao_faturas_updated ON cartao_faturas;
CREATE TRIGGER trg_cartao_faturas_updated
  BEFORE UPDATE ON cartao_faturas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 6) RLS — pattern atual do sistema (authenticated_all)
-- TODO: quando C28–C32 da auditoria forem resolvidos, fechar para empresa_id
-- ---------------------------------------------------------------------------
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartao_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartao_faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cartoes_authenticated_all ON cartoes;
CREATE POLICY cartoes_authenticated_all ON cartoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cartao_compras_authenticated_all ON cartao_compras;
CREATE POLICY cartao_compras_authenticated_all ON cartao_compras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cartao_faturas_authenticated_all ON cartao_faturas;
CREATE POLICY cartao_faturas_authenticated_all ON cartao_faturas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;

-- ---------------------------------------------------------------------------
-- 7) Verificação (rode separado pra conferir)
-- ---------------------------------------------------------------------------
-- SELECT 'cartoes' as tabela, count(*) FROM cartoes
-- UNION ALL SELECT 'cartao_faturas', count(*) FROM cartao_faturas
-- UNION ALL SELECT 'cartao_compras', count(*) FROM cartao_compras;
