import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricoEntry {
  id: number;
  created_at: string;
  ator_nome: string;
  campo: string;
  valor_antigo: any;
  valor_novo: any;
}

/**
 * Histórico campo-por-campo de uma entidade (processo ou orçamento).
 * Criado em 18/05/2026 — ver docs/sql/historico-entidade-audit.sql.
 */
export function useHistoricoEntidade(
  entidadeTipo: 'processo' | 'orcamento',
  entidadeId: string | null | undefined,
  limit = 50
) {
  return useQuery({
    queryKey: ['historico_entidade', entidadeTipo, entidadeId, limit],
    enabled: !!entidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_historico_entidade' as any, {
        p_entidade_tipo: entidadeTipo,
        p_entidade_id: entidadeId,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as HistoricoEntry[];
    },
    staleTime: 30_000,
  });
}

// Label friendly por campo
export const CAMPO_LABELS: Record<string, string> = {
  valor: 'Valor',
  etapa: 'Etapa',
  data_deferimento: 'Data deferimento',
  responsavel: 'Responsável',
  tipo: 'Tipo',
  razao_social: 'Razão social',
  prioridade: 'Prioridade',
  is_archived: 'Arquivado',
  dentro_do_plano: 'Dentro do plano',
  valor_avulso: 'Valor avulso',
  notas: 'Notas',
  status: 'Status',
  valor_final: 'Valor final',
  prospect_nome: 'Empresa',
  prospect_cnpj: 'CNPJ',
  validade_dias: 'Validade (dias)',
  desconto_pct: 'Desconto (%)',
  data_expiracao: 'Expira em',
};

export function fmtValor(campo: string, v: any): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (campo === 'valor' || campo === 'valor_final' || campo === 'valor_avulso') {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(v);
  }
  if (campo.includes('data')) {
    try {
      return new Date(v).toLocaleDateString('pt-BR');
    } catch { return String(v); }
  }
  if (typeof v === 'string' && v.length > 50) return v.substring(0, 47) + '…';
  return String(v);
}
