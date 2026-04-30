import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSidebarCounts() {
  return useQuery({
    queryKey: ['sidebar_counts'],
    queryFn: async () => {
      const [processosRes, financeiroRes, docsRes, orcamentosRes] = await Promise.all([
        supabase.from('processos').select('id', { count: 'exact', head: true })
          .not('etapa', 'in', '("finalizados","arquivo")')
          .neq('is_archived', true),
        supabase.from('lancamentos').select('id', { count: 'exact', head: true })
          .eq('tipo', 'receber').in('status', ['pendente', 'atrasado']),
        supabase.from('documentos').select('id', { count: 'exact', head: true })
          .eq('status', 'pendente'),
        supabase.from('orcamentos').select('id', { count: 'exact', head: true })
          .in('status', ['rascunho', 'enviado']),
      ]);

      return {
        processosAtivos: processosRes.count || 0,
        pendentesFinanceiro: financeiroRes.count || 0,
        docsPendentes: docsRes.count || 0,
        orcamentosPendentes: orcamentosRes.count || 0,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
