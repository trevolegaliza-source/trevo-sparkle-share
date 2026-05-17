import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DSOData {
  dso_geral: number;
  dso_pagos: number;
  dso_em_aberto: number;
  total_lancamentos: number;
  dias_lookback: number;
}

export interface InadimplenteItem {
  cliente_id: string;
  cliente_nome: string;
  cliente_apelido: string | null;
  qtd_lancs_atraso: number;
  valor_total: number;
  dias_max_atraso: number;
}

/**
 * DSO + Top Inadimplentes — métricas de cobrança pro Dashboard.
 * Onda 8 pré-viagem (17/05/2026). Ver docs/sql/dso-e-top-inadimplentes.sql.
 */
export function useDSOData(diasLookback = 90, limitTopN = 5) {
  return useQuery({
    queryKey: ['dso_data', diasLookback, limitTopN],
    queryFn: async () => {
      const [dsoResp, topResp] = await Promise.all([
        supabase.rpc('calcular_dso' as any, { p_dias_lookback: diasLookback }),
        supabase.rpc('top_inadimplentes' as any, { p_limit: limitTopN }),
      ]);
      if (dsoResp.error) throw dsoResp.error;
      if (topResp.error) throw topResp.error;
      return {
        dso: (dsoResp.data ?? {}) as DSOData,
        top: ((topResp.data ?? []) as InadimplenteItem[]),
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
