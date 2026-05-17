import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Veredito =
  | 'vai_bater_folgado'
  | 'vai_bater'
  | 'no_limite'
  | 'abaixo'
  | 'sem_historico';

export interface PrevisaoMes {
  recebido_mes: number;
  pendente_mes: number;
  previsto_total: number;
  meta_historica: number;
  pct_atingido: number;
  dias_restantes_mes: number;
  veredito: Veredito;
}

/**
 * Previsão "vai bater o mês?" — Onda 9 pré-viagem (17/05/2026).
 * Ver docs/sql/previsao-mes-atual.sql.
 */
export function usePrevisaoMes() {
  return useQuery({
    queryKey: ['previsao_mes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prever_mes_atual' as any);
      if (error) throw error;
      return (data ?? {}) as PrevisaoMes;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
